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
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

export function registerBookingRoutes(
  app: BookingRouteApp,
  options: {
    db: Db
    mailer: Mailer
  },
) {
  const { db, mailer } = options
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
        notifyBookingChange(db, mailer, booking.id, "booking_created")

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
          actorUserId: user.id,
        })
        notifyBookingChange(db, mailer, booking.id, "booking_updated")

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
        notifyBookingChange(db, mailer, current.id, "booking_deleted")
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
  bookingId: string,
  kind: "booking_created" | "booking_updated" | "booking_deleted",
) {
  sendBookingNotification(db, mailer, { bookingId, kind }).catch((error) => {
    console.error("[lab-api] booking notification failed", error)
  })
}
