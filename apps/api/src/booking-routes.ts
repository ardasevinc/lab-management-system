import {
  createBooking,
  type Db,
  deleteBooking,
  ForbiddenError,
  getBooking,
  type getSessionUser,
  listBookingAuditEvents,
  NotFoundError,
  updateBooking,
} from "@lab/db"
import type { Hono } from "hono"
import { z } from "zod"
import { handleApiResult } from "./api-errors"
import type { ApiRuntimeConfig } from "./env"
import type { Mailer } from "./mailer"
import { sendBookingNotification } from "./notifications"

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
type BookingRouteApp = Hono<{ Variables: { user: CurrentUser } }>

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
  .extend({
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .partial()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"),
    "At least one field is required",
  )

const deleteBookingQuerySchema = z.object({
  reason: z.string().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

export function registerBookingRoutes(
  app: BookingRouteApp,
  options: {
    db: Db
    mailer: Mailer
    publicAppUrl: ApiRuntimeConfig["publicAppUrl"]
  },
) {
  const { db, mailer, publicAppUrl } = options
  const enqueueBookingWrite = createSerialQueue()

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
        notifyBookingChange(db, mailer, publicAppUrl, booking.id, "booking_created")

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

        const nextUserId = body.data.userId ?? current.userId
        const nextType = body.data.type ?? current.type

        assertCanWriteBooking(user, {
          userId: current.userId,
          type: current.type,
        })
        assertCanWriteBooking(user, {
          userId: nextUserId,
          type: nextType,
        })

        const booking = await updateBooking(db, c.req.param("id"), {
          ...body.data,
          startsAt: body.data.startsAt ? new Date(body.data.startsAt) : undefined,
          endsAt: body.data.endsAt ? new Date(body.data.endsAt) : undefined,
          expectedUpdatedAt: body.data.expectedUpdatedAt
            ? new Date(body.data.expectedUpdatedAt)
            : undefined,
          actorUserId: user.id,
        })
        notifyBookingChange(db, mailer, publicAppUrl, booking.id, "booking_updated", booking.userId)

        if (current.userId !== booking.userId) {
          notifyBookingChange(
            db,
            mailer,
            publicAppUrl,
            booking.id,
            "booking_updated",
            current.userId,
          )
        }

        return c.json({ booking })
      }),
    )
  })

  app.delete("/bookings/:id", async (c) =>
    handleApiResult(c, () =>
      enqueueBookingWrite(async () => {
        const query = deleteBookingQuerySchema.safeParse({
          reason: c.req.query("reason"),
          expectedUpdatedAt: c.req.query("expectedUpdatedAt"),
        })

        if (!query.success) {
          return c.json({ error: "Invalid booking delete", issues: query.error.issues }, 400)
        }

        const user = c.get("user")
        const current = await getBooking(db, c.req.param("id"))

        if (!current) {
          throw new NotFoundError("Booking not found")
        }

        assertCanWriteBooking(user, current)
        await deleteBooking(
          db,
          c.req.param("id"),
          user.id,
          query.data.reason,
          query.data.expectedUpdatedAt ? new Date(query.data.expectedUpdatedAt) : undefined,
        )
        notifyBookingChange(db, mailer, publicAppUrl, current.id, "booking_deleted")
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
  publicAppUrl: ApiRuntimeConfig["publicAppUrl"],
  bookingId: string,
  kind: "booking_created" | "booking_updated" | "booking_deleted",
  recipientUserId?: string,
) {
  sendBookingNotification(db, mailer, { bookingId, kind, recipientUserId }, { publicAppUrl }).catch(
    (error) => {
      console.error("[lab-api] booking notification failed", error)
    },
  )
}
