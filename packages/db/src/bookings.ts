import { and, asc, eq, gt, isNull, lt, ne } from "drizzle-orm"
import type { Db } from "."
import { BookingConflictError, InvalidBookingRangeError, NotFoundError } from "./errors"
import { mapAuditEvent, mapBooking } from "./mappers"
import { bookingAuditEvents, bookings, machines, users } from "./schema"

type DbLike = Pick<Db, "insert" | "query" | "select" | "update">

export type BookingType = "normal" | "maintenance"

export type CreateBookingInput = {
  machineId: string
  userId: string
  title: string
  notes?: string | null
  type?: BookingType
  startsAt: Date
  endsAt: Date
  actorUserId: string
  reason?: string | null
}

export type UpdateBookingInput = Partial<
  Pick<
    CreateBookingInput,
    "machineId" | "title" | "notes" | "type" | "startsAt" | "endsAt" | "reason"
  >
> & {
  actorUserId: string
}

export async function listBookingsForMachine(db: Db, machineId: string, start: Date, end: Date) {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.machineId, machineId),
        isNull(bookings.deletedAt),
        lt(bookings.startsAt, end),
        gt(bookings.endsAt, start),
      ),
    )
    .orderBy(asc(bookings.startsAt))

  return rows.map(mapBooking)
}

export async function createBooking(db: Db, input: CreateBookingInput) {
  assertValidRange(input.startsAt, input.endsAt)

  return db.transaction(async (tx) => {
    await assertMachineBookable(tx, input.machineId)
    await assertUserExists(tx, input.userId)
    await assertUserExists(tx, input.actorUserId)
    await assertNoOverlap(tx, {
      machineId: input.machineId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    })

    const now = new Date()
    const id = crypto.randomUUID()
    const values = {
      id,
      machineId: input.machineId,
      userId: input.userId,
      title: input.title,
      notes: input.notes ?? null,
      type: input.type ?? "normal",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await tx.insert(bookings).values(values)
    await insertAudit(tx, {
      bookingId: id,
      actorUserId: input.actorUserId,
      eventType: "created",
      reason: input.reason ?? null,
      payload: values,
    })

    return mapBooking(values)
  })
}

export async function updateBooking(db: Db, id: string, input: UpdateBookingInput) {
  return db.transaction(async (tx) => {
    await assertUserExists(tx, input.actorUserId)
    const current = await tx.query.bookings.findFirst({
      where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
    })

    if (!current) {
      throw new NotFoundError("Booking not found")
    }

    const next = {
      machineId: input.machineId ?? current.machineId,
      title: input.title ?? current.title,
      notes: input.notes === undefined ? current.notes : input.notes,
      type: input.type ?? current.type,
      startsAt: input.startsAt ?? current.startsAt,
      endsAt: input.endsAt ?? current.endsAt,
    }

    assertValidRange(next.startsAt, next.endsAt)
    await assertMachineExists(tx, next.machineId)
    await assertNoOverlap(tx, {
      machineId: next.machineId,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      excludeBookingId: id,
    })

    const now = new Date()
    await tx
      .update(bookings)
      .set({
        ...next,
        updatedAt: now,
      })
      .where(eq(bookings.id, id))

    const updated = { ...current, ...next, updatedAt: now }
    await insertAudit(tx, {
      bookingId: id,
      actorUserId: input.actorUserId,
      eventType: "updated",
      reason: input.reason ?? null,
      payload: { before: current, after: updated },
    })

    return mapBooking(updated)
  })
}

export async function deleteBooking(
  db: Db,
  id: string,
  actorUserId: string,
  reason?: string | null,
) {
  return db.transaction(async (tx) => {
    await assertUserExists(tx, actorUserId)
    const current = await tx.query.bookings.findFirst({
      where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
    })

    if (!current) {
      throw new NotFoundError("Booking not found")
    }

    const now = new Date()
    await tx.update(bookings).set({ deletedAt: now, updatedAt: now }).where(eq(bookings.id, id))
    await insertAudit(tx, {
      bookingId: id,
      actorUserId,
      eventType: "deleted",
      reason: reason ?? null,
      payload: current,
    })
  })
}

export async function getBooking(db: Db, id: string) {
  const row = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
  })
  return row ? mapBooking(row) : null
}

export async function listBookingAuditEvents(db: Db, bookingId: string) {
  const rows = await db
    .select()
    .from(bookingAuditEvents)
    .where(eq(bookingAuditEvents.bookingId, bookingId))
    .orderBy(asc(bookingAuditEvents.createdAt))

  return rows.map(mapAuditEvent)
}

function assertValidRange(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new InvalidBookingRangeError()
  }
}

async function assertNoOverlap(
  db: DbLike,
  input: { machineId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string },
) {
  const conditions = [
    eq(bookings.machineId, input.machineId),
    isNull(bookings.deletedAt),
    lt(bookings.startsAt, input.endsAt),
    gt(bookings.endsAt, input.startsAt),
  ]

  if (input.excludeBookingId) {
    conditions.push(ne(bookings.id, input.excludeBookingId))
  }

  const overlapping = await db.query.bookings.findFirst({
    where: and(...conditions),
  })

  if (overlapping) {
    throw new BookingConflictError()
  }
}

async function assertMachineExists(db: DbLike, id: string) {
  const machine = await db.query.machines.findFirst({ where: eq(machines.id, id) })
  if (!machine) {
    throw new NotFoundError("Machine not found")
  }

  return machine
}

async function assertMachineBookable(db: DbLike, id: string) {
  const machine = await assertMachineExists(db, id)

  if (!machine.active) {
    throw new InvalidBookingRangeError("Machine is not bookable")
  }
}

async function assertUserExists(db: DbLike, id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!user) {
    throw new NotFoundError("User not found")
  }
}

async function insertAudit(
  db: DbLike,
  input: {
    bookingId: string
    actorUserId: string
    eventType: "created" | "updated" | "deleted" | "admin_override"
    reason?: string | null
    payload: unknown
  },
) {
  await db.insert(bookingAuditEvents).values({
    id: crypto.randomUUID(),
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    reason: input.reason ?? null,
    payloadJson: JSON.stringify(input.payload),
    createdAt: new Date(),
  })
}
