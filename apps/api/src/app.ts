import { labConfig } from "@lab/config"
import {
  type Db,
  deleteSession,
  getMachineBySlug,
  getSessionUser,
  listBookingsForMachine,
  listMachines,
  requestLoginOtp,
  verifyLoginOtp,
} from "@lab/db"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { cors } from "hono/cors"
import { z } from "zod"
import { registerAdminRoutes } from "./admin-routes"
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
  otpRateLimitWindowSeconds: 900,
  otpRateLimitMaxRequests: 5,
}

type OtpRateLimitBucket = {
  count: number
  resetAt: number
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
  const otpRateLimits = new Map<string, OtpRateLimitBucket>()

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

    const rateLimit = consumeOtpRateLimit(otpRateLimits, body.data.email, runtimeConfig)
    if (!rateLimit.allowed) {
      c.header("Retry-After", String(rateLimit.retryAfterSeconds))
      return c.json({ error: "Too many login code requests" }, 429)
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

  app.get("/auth/session", async (c) => {
    const user = await getSessionUser(db, sessionToken(c))
    return c.json({ user })
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

  registerAdminRoutes(app, {
    db,
    mailer: emailSender,
    publicAppUrl: runtimeConfig.publicAppUrl,
    requireAuth: requireAuth(db),
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

function consumeOtpRateLimit(
  buckets: Map<string, OtpRateLimitBucket>,
  email: string,
  config: ApiRuntimeConfig,
  now = Date.now(),
) {
  const key = email.trim().toLowerCase()
  const windowMs = config.otpRateLimitWindowSeconds * 1000
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= config.otpRateLimitMaxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { allowed: true }
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
