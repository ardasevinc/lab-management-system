import { labConfig } from "@lab/config"
import {
  createInvite,
  createMachine,
  type Db,
  deleteMachine,
  deleteSession,
  ForbiddenError,
  getMachineBySlug,
  getSessionUser,
  listBookingsForMachine,
  listMachines,
  listUsers,
  requestLoginOtp,
  updateMachine,
  updateUserAccess,
  verifyLoginOtp,
} from "@lab/db"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { cors } from "hono/cors"
import { z } from "zod"
import { apiErrorResponse, handleApiResult } from "./api-errors"
import { registerBookingRoutes } from "./booking-routes"
import type { ApiRuntimeConfig, NotificationWorkerConfig } from "./env"
import { createConsoleMailer, type Mailer } from "./mailer"

const bookingRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
})

const loginRequestSchema = z.object({
  email: z.string().email(),
})

const loginVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(12),
})

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "member"]).default("member"),
})

const userAccessPatchSchema = z
  .object({
    role: z.enum(["admin", "member"]).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

const machinePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    specs: z.array(z.string()).optional(),
    accessNotes: z.string().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

const machineCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  specs: z.array(z.string()).optional(),
  accessNotes: z.string().optional(),
  active: z.boolean().optional(),
})

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>

export type ApiAppOptions = {
  db: Db
  config?: Partial<ApiRuntimeConfig>
  notificationWorker?: NotificationWorkerConfig
  mailer?: Mailer
  assetMiddleware?: MiddlewareHandler
  webMiddleware?: MiddlewareHandler
}

const defaultRuntimeConfig: ApiRuntimeConfig = {
  appEnv: "development",
  publicAppUrl: "http://localhost:5173",
  corsOrigins: ["http://localhost:5173"],
  sessionCookieSecure: false,
  devShowOtp: true,
}

const defaultNotificationWorkerConfig: NotificationWorkerConfig = {
  enabled: false,
  intervalSeconds: 60,
  startReminderMinutes: 15,
  endingReminderMinutes: 15,
  retryDelayMinutes: 5,
  maxAttempts: 3,
}

export function createApiApp({
  db,
  config,
  notificationWorker,
  mailer,
  assetMiddleware,
  webMiddleware,
}: ApiAppOptions) {
  const app = new Hono<{ Variables: { user: CurrentUser } }>()
  const runtimeConfig = { ...defaultRuntimeConfig, ...config }
  const notificationWorkerConfig = notificationWorker ?? defaultNotificationWorkerConfig
  const emailSender = mailer ?? createConsoleMailer()

  app.onError((error, c) => apiErrorResponse(c, error))

  app.use(
    "*",
    cors({
      origin: runtimeConfig.corsOrigins,
      credentials: true,
    }),
  )

  app.get("/health", (c) => healthResponse(c, db, notificationWorkerConfig))

  app.get("/config/public", (c) => c.json(labConfig))

  if (webMiddleware) {
    app.get("/", webMiddleware)
    app.get("/login", webMiddleware)
    app.get("/schedule", webMiddleware)
    app.get("/machines", htmlNavigationOnly(webMiddleware))
    app.get("/admin", webMiddleware)
    app.get("/admin/*", htmlNavigationOnly(webMiddleware))
  }

  app.post("/auth/request-otp", async (c) => {
    const body = loginRequestSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid login request", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const otp = await requestLoginOtp(db, body.data.email)
      await emailSender.sendLoginOtp({
        to: otp.email,
        code: otp.code,
        expiresAt: otp.expiresAt,
      })

      return c.json({
        ok: true,
        email: otp.email,
        devCode: runtimeConfig.devShowOtp ? otp.code : undefined,
        expiresAt: otp.expiresAt,
      })
    })
  })

  app.post("/auth/verify-otp", async (c) => {
    const body = loginVerifySchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid login verification", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const session = await verifyLoginOtp(db, body.data.email, body.data.code)
      setSessionCookie(c, session.token, session.expiresAt, runtimeConfig)
      return c.json({ user: session.user, token: session.token, expiresAt: session.expiresAt })
    })
  })

  app.post("/auth/logout", async (c) => {
    await deleteSession(db, sessionToken(c))
    clearSessionCookie(c, runtimeConfig)
    return c.json({ ok: true })
  })

  app.use("/auth/me", requireAuth(db))
  app.get("/auth/me", (c) => c.json({ user: c.get("user") }))

  app.use("/machines", requireAuth(db))
  app.use("/machines/*", requireAuth(db))
  app.get("/machines", async (c) => c.json({ machines: await listMachines(db) }))

  app.get("/machines/:slug", async (c) => {
    const machine = await getMachineBySlug(db, c.req.param("slug"))

    if (!machine) {
      return c.json({ error: "Machine not found" }, 404)
    }

    return c.json({ machine })
  })

  app.get("/machines/:slug/bookings", async (c) => {
    const machine = await getMachineBySlug(db, c.req.param("slug"))

    if (!machine) {
      return c.json({ error: "Machine not found" }, 404)
    }

    const range = bookingRangeSchema.safeParse({
      start: c.req.query("start"),
      end: c.req.query("end"),
    })

    if (!range.success) {
      return c.json({ error: "Invalid booking range", issues: range.error.issues }, 400)
    }

    const bookings = await listBookingsForMachine(
      db,
      machine.id,
      new Date(range.data.start),
      new Date(range.data.end),
    )

    return c.json({ bookings })
  })

  app.use("/bookings", requireAuth(db))
  app.use("/bookings/*", requireAuth(db))
  registerBookingRoutes(app, { db, mailer: emailSender, publicAppUrl: runtimeConfig.publicAppUrl })

  for (const path of [
    "/admin/users",
    "/admin/users/*",
    "/admin/machines",
    "/admin/machines/*",
    "/admin/invites",
  ]) {
    app.use(path, requireAuth(db))
    app.use(path, async (c, next) => {
      assertAdmin(c.get("user"))
      await next()
    })
  }

  app.get("/admin/users", async (c) => c.json({ users: await listUsers(db) }))

  app.post("/admin/machines", async (c) => {
    const body = machineCreateSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid machine", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const machine = await createMachine(db, sanitizeMachineInput(body.data))
      return c.json({ machine }, 201)
    })
  })

  app.patch("/admin/machines/:id", async (c) => {
    const body = machinePatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid machine update", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const machine = await updateMachine(db, c.req.param("id"), sanitizeMachineInput(body.data))
      return c.json({ machine })
    })
  })

  app.delete("/admin/machines/:id", async (c) =>
    handleApiResult(c, async () => {
      const machine = await deleteMachine(db, c.req.param("id"))
      return c.json({ machine })
    }),
  )

  app.patch("/admin/users/:id", async (c) => {
    const body = userAccessPatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid user update", issues: body.error.issues }, 400)
    }

    const currentUser = c.get("user")

    if (c.req.param("id") === currentUser.id) {
      throw new ForbiddenError("Admins cannot change their own access")
    }

    return handleApiResult(c, async () => {
      const user = await updateUserAccess(db, c.req.param("id"), body.data)
      return c.json({ user })
    })
  })

  app.post("/admin/invites", async (c) => {
    const body = inviteSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid invite", issues: body.error.issues }, 400)
    }

    const invite = await createInvite(db, {
      ...body.data,
      invitedByUserId: c.get("user").id,
    })
    await emailSender.sendInviteEmail({
      to: invite.email,
      name: invite.name,
      role: invite.role,
      loginUrl: loginUrlForInvite(runtimeConfig.publicAppUrl, invite.email),
    })

    return c.json({ invite }, 201)
  })

  if (assetMiddleware) {
    app.get("/assets/*", assetMiddleware)
    for (const path of publicAssetPaths(labConfig.logoPath, labConfig.faviconPath)) {
      app.get(path, assetMiddleware)
    }
  }

  if (webMiddleware) {
    app.get("*", htmlNavigationOnly(webMiddleware))
  }

  return app
}

function htmlNavigationOnly(webMiddleware: MiddlewareHandler): MiddlewareHandler {
  return async (c, next) => {
    if (!acceptsHtml(c)) {
      await next()
      return
    }

    return webMiddleware(c, next)
  }
}

function acceptsHtml(c: Context) {
  return c.req.header("accept")?.includes("text/html") ?? false
}

function publicAssetPaths(...paths: string[]) {
  return paths.filter((path) => path.startsWith("/") && !path.startsWith("/assets/"))
}

function requireAuth(db: Db): MiddlewareHandler<{ Variables: { user: CurrentUser } }> {
  return async (c, next) => {
    const user = await getSessionUser(db, sessionToken(c))

    if (!user) {
      return c.json({ error: "Authentication required" }, 401)
    }

    c.set("user", user)
    await next()
  }
}

async function healthResponse(c: Context, db: Db, notificationWorker: NotificationWorkerConfig) {
  try {
    const machines = await listMachines(db)
    if (!machines.length) {
      return c.json(
        {
          ok: false,
          service: "lab-api",
          lab: labConfig.shortName,
          checks: {
            database: "ok",
            machines: 0,
            reminders: reminderHealth(notificationWorker),
          },
        },
        503,
      )
    }

    return c.json({
      ok: true,
      service: "lab-api",
      lab: labConfig.shortName,
      checks: {
        database: "ok",
        machines: machines.length,
        reminders: reminderHealth(notificationWorker),
      },
    })
  } catch {
    return c.json(
      {
        ok: false,
        service: "lab-api",
        lab: labConfig.shortName,
        checks: {
          database: "unhealthy",
          reminders: reminderHealth(notificationWorker),
        },
      },
      503,
    )
  }
}

function reminderHealth(config: NotificationWorkerConfig) {
  return {
    enabled: config.enabled,
    intervalSeconds: config.intervalSeconds,
    startReminderMinutes: config.startReminderMinutes,
    endingReminderMinutes: config.endingReminderMinutes,
    retryDelayMinutes: config.retryDelayMinutes,
    maxAttempts: config.maxAttempts,
  }
}

function sessionToken(c: Context) {
  const authorization = c.req.header("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length)
  }

  return getCookie(c, "lab_session")
}

function setSessionCookie(c: Context, token: string, expiresAt: string, config: ApiRuntimeConfig) {
  setCookie(c, "lab_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: config.sessionCookieSecure,
    domain: config.sessionCookieDomain,
    expires: new Date(expiresAt),
  })
}

function clearSessionCookie(c: Context, config: ApiRuntimeConfig) {
  deleteCookie(c, "lab_session", {
    path: "/",
    secure: config.sessionCookieSecure,
    domain: config.sessionCookieDomain,
  })
}

function loginUrlForInvite(publicAppUrl: string, email: string) {
  const url = new URL("/login", publicAppUrl)
  url.searchParams.set("email", email)
  return url.toString()
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "admin") {
    throw new ForbiddenError("Admin role required")
  }
}

function sanitizeMachineInput<T extends { specs?: string[]; name?: string; slug?: string }>(
  input: T,
) {
  return {
    ...input,
    name: input.name?.trim(),
    slug: input.slug?.trim(),
    specs: input.specs?.map((spec) => spec.trim()).filter(Boolean),
  }
}
