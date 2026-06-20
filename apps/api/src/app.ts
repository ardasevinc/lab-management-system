import { labConfig } from "@lab/config"
import {
  AuthError,
  BookingConflictError,
  createBooking,
  createInvite,
  type Db,
  deleteBooking,
  deleteSession,
  ForbiddenError,
  getBooking,
  getMachineBySlug,
  getSessionUser,
  InvalidBookingRangeError,
  listBookingAuditEvents,
  listBookingsForMachine,
  listMachines,
  listUsers,
  NotFoundError,
  requestLoginOtp,
  updateBooking,
  verifyLoginOtp,
} from "@lab/db"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { cors } from "hono/cors"
import { z } from "zod"
import type { ApiRuntimeConfig } from "./env"
import { createConsoleMailer, type Mailer } from "./mailer"
import { sendBookingNotification } from "./notifications"

const bookingBodySchema = z.object({
  machineId: z.string().min(1),
  userId: z.string().min(1).optional(),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  type: z.enum(["normal", "maintenance"]).default("normal"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().nullable().optional(),
})

const bookingPatchSchema = bookingBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

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

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>

export type ApiAppOptions = {
  db: Db
  config?: Partial<ApiRuntimeConfig>
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

export function createApiApp({
  db,
  config,
  mailer,
  assetMiddleware,
  webMiddleware,
}: ApiAppOptions) {
  const app = new Hono<{ Variables: { user: CurrentUser } }>()
  const runtimeConfig = { ...defaultRuntimeConfig, ...config }
  const emailSender = mailer ?? createConsoleMailer()
  const enqueueBookingWrite = createSerialQueue()

  app.onError((error, c) => apiErrorResponse(c, error))

  app.use(
    "*",
    cors({
      origin: runtimeConfig.corsOrigins,
      credentials: true,
    }),
  )

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "lab-api",
      lab: labConfig.shortName,
    }),
  )

  app.get("/config/public", (c) => c.json(labConfig))

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
  app.post("/bookings", async (c) => {
    const body = bookingBodySchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid booking", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, () =>
      enqueueBookingWrite(async () => {
        const user = c.get("user")
        const userId = body.data.userId ?? user.id
        assertCanWriteBooking(user, { userId, type: body.data.type })
        const booking = await createBooking(db, {
          ...body.data,
          userId,
          startsAt: new Date(body.data.startsAt),
          endsAt: new Date(body.data.endsAt),
          actorUserId: user.id,
        })
        notifyBookingChange(db, emailSender, booking.id, "booking_created")

        return c.json({ booking }, 201)
      }),
    )
  })

  app.patch("/bookings/:id", async (c) => {
    const body = bookingPatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid booking update", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, () =>
      enqueueBookingWrite(async () => {
        const user = c.get("user")
        const current = await getBooking(db, c.req.param("id"))

        if (!current) {
          throw new NotFoundError("Booking not found")
        }

        assertCanWriteBooking(user, {
          userId: current.userId,
          type: body.data.type ?? current.type,
        })

        const booking = await updateBooking(db, c.req.param("id"), {
          ...body.data,
          startsAt: body.data.startsAt ? new Date(body.data.startsAt) : undefined,
          endsAt: body.data.endsAt ? new Date(body.data.endsAt) : undefined,
          actorUserId: user.id,
        })
        notifyBookingChange(db, emailSender, booking.id, "booking_updated")

        return c.json({ booking })
      }),
    )
  })

  app.delete("/bookings/:id", async (c) =>
    handleApiResult(c, () =>
      enqueueBookingWrite(async () => {
        const user = c.get("user")
        const current = await getBooking(db, c.req.param("id"))

        if (!current) {
          throw new NotFoundError("Booking not found")
        }

        assertCanWriteBooking(user, current)
        await deleteBooking(db, c.req.param("id"), user.id, c.req.query("reason"))
        notifyBookingChange(db, emailSender, current.id, "booking_deleted")
        return c.json({ ok: true })
      }),
    ),
  )

  app.get("/bookings/:id/audit", async (c) =>
    handleApiResult(c, async () => {
      assertAdmin(c.get("user"))
      return c.json({ events: await listBookingAuditEvents(db, c.req.param("id")) })
    }),
  )

  app.use("/admin/*", requireAuth(db))
  app.use("/admin/*", async (c, next) => {
    assertAdmin(c.get("user"))
    await next()
  })

  app.get("/admin/users", async (c) => c.json({ users: await listUsers(db) }))

  app.post("/admin/invites", async (c) => {
    const body = inviteSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid invite", issues: body.error.issues }, 400)
    }

    const invite = await createInvite(db, {
      ...body.data,
      invitedByUserId: c.get("user").id,
    })

    return c.json({ invite }, 201)
  })

  if (assetMiddleware && webMiddleware) {
    app.get("/assets/*", assetMiddleware)
    app.get("/", webMiddleware)
    app.get("*", webMiddleware)
  }

  return app
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

function assertCanWriteBooking(
  user: CurrentUser,
  booking: { userId: string; type: "normal" | "maintenance" },
) {
  if (user.role === "admin") {
    return
  }

  if (booking.type === "maintenance" || booking.userId !== user.id) {
    throw new ForbiddenError("Admins are required for this booking change")
  }
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "admin") {
    throw new ForbiddenError("Admin role required")
  }
}

async function handleApiResult(c: Context, fn: () => Promise<Response>) {
  try {
    return await fn()
  } catch (error) {
    return apiErrorResponse(c, error)
  }
}

function createSerialQueue() {
  let queue = Promise.resolve()

  return async function enqueue<T>(operation: () => Promise<T>) {
    const result = queue.then(operation, operation)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}

function notifyBookingChange(
  db: Db,
  mailer: Mailer,
  bookingId: string,
  kind: "booking_created" | "booking_updated" | "booking_deleted",
) {
  sendBookingNotification(db, mailer, { bookingId, kind }).catch((error) => {
    console.error("[lab-api] booking notification failed", error)
  })
}

function apiErrorResponse(c: Context, error: unknown) {
  if (error instanceof BookingConflictError) {
    return c.json({ error: error.message }, 409)
  }

  if (error instanceof InvalidBookingRangeError) {
    return c.json({ error: error.message }, 400)
  }

  if (error instanceof NotFoundError) {
    return c.json({ error: error.message }, 404)
  }

  if (error instanceof AuthError) {
    return c.json({ error: error.message }, 401)
  }

  if (error instanceof ForbiddenError) {
    return c.json({ error: error.message }, 403)
  }

  throw error
}
