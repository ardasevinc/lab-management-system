import { and, asc, eq, gt, isNull, lt } from "drizzle-orm"
import type { Db } from "."
import { insertBookingAudit } from "./booking-audit"
import {
  assertActiveUserExists,
  assertMachineBookable,
  assertMachineExists,
  assertNoBookingOverlap,
  assertUserExists,
  assertValidBookingRange,
} from "./booking-validation"
import { NotFoundError } from "./errors"
import { mapBooking } from "./mappers"
import { bookings } from "./schema"

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
    "machineId" | "userId" | "title" | "notes" | "type" | "startsAt" | "endsAt" | "reason"
  >
> & {
  actorUserId: string
}

export { listBookingAuditEvents } from "./booking-audit"

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
  assertValidBookingRange(input.startsAt, input.endsAt)

  return db.transaction(async (tx) => {
    await assertMachineBookable(tx, input.machineId)
    await assertActiveUserExists(tx, input.userId)
    await assertUserExists(tx, input.actorUserId)
    await assertNoBookingOverlap(tx, {
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
    await insertBookingAudit(tx, {
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
      userId: input.userId ?? current.userId,
      title: input.title ?? current.title,
      notes: input.notes === undefined ? current.notes : input.notes,
      type: input.type ?? current.type,
      startsAt: input.startsAt ?? current.startsAt,
      endsAt: input.endsAt ?? current.endsAt,
    }

    assertValidBookingRange(next.startsAt, next.endsAt)
    await assertMachineExists(tx, next.machineId)
    if (input.userId !== undefined) {
      await assertActiveUserExists(tx, next.userId)
    }
    await assertNoBookingOverlap(tx, {
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
    await insertBookingAudit(tx, {
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
    await insertBookingAudit(tx, {
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
