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
import { BookingConflictError, ForbiddenError, NotFoundError, StaleBookingError } from "./errors"
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
  expectedUpdatedAt?: Date
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
    await assertActorCanWriteBooking(tx, input.actorUserId, {
      userId: input.userId,
      type: input.type ?? "normal",
    })
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

    await insertBookingRow(tx, values)
    await insertBookingAudit(tx, {
      bookingId: id,
      actorUserId: input.actorUserId,
      eventType: "created",
      reason: input.reason ?? null,
      payload: values,
    })

    const created = await tx.query.bookings.findFirst({ where: eq(bookings.id, id) })
    if (!created) {
      throw new NotFoundError("Booking not found")
    }

    return mapBooking(created)
  })
}

export async function updateBooking(db: Db, id: string, input: UpdateBookingInput) {
  return db.transaction(async (tx) => {
    const current = await tx.query.bookings.findFirst({
      where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
    })

    if (!current) {
      throw new NotFoundError("Booking not found")
    }

    if (
      input.expectedUpdatedAt &&
      current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
    ) {
      throw new StaleBookingError()
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
    if (changesBookingPlacement(input)) {
      await assertMachineBookable(tx, next.machineId)
    } else {
      await assertMachineExists(tx, next.machineId)
    }
    if (input.userId !== undefined) {
      await assertActiveUserExists(tx, next.userId)
    }
    await assertActorCanWriteBooking(tx, input.actorUserId, {
      userId: current.userId,
      type: current.type,
    })
    await assertActorCanWriteBooking(tx, input.actorUserId, {
      userId: next.userId,
      type: next.type,
    })
    await assertNoBookingOverlap(tx, {
      machineId: next.machineId,
      startsAt: next.startsAt,
      endsAt: next.endsAt,
      excludeBookingId: id,
    })

    const now = nextVersionDate(current.updatedAt)
    const [updated] = await updateBookingRow(tx, id, current.updatedAt, {
      ...next,
      updatedAt: now,
    })

    if (!updated) {
      throw new StaleBookingError()
    }

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
  expectedUpdatedAt?: Date,
) {
  return db.transaction(async (tx) => {
    const current = await tx.query.bookings.findFirst({
      where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
    })

    if (!current) {
      throw new NotFoundError("Booking not found")
    }

    await assertActorCanWriteBooking(tx, actorUserId, current)

    if (expectedUpdatedAt && current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new StaleBookingError()
    }

    const now = nextVersionDate(current.updatedAt)
    const [deleted] = await tx
      .update(bookings)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(bookings.id, id),
          isNull(bookings.deletedAt),
          eq(bookings.updatedAt, current.updatedAt),
        ),
      )
      .returning()

    if (!deleted) {
      throw new StaleBookingError()
    }

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

function changesBookingPlacement(input: UpdateBookingInput) {
  return input.machineId !== undefined || input.startsAt !== undefined || input.endsAt !== undefined
}

type QueryDb = Pick<Db, "query">
type WriteDb = Pick<Db, "insert" | "update">
type BookingWriteTarget = { userId: string; type: BookingType }

async function assertActorCanWriteBooking(
  db: QueryDb,
  actorUserId: string,
  booking: BookingWriteTarget,
) {
  const actor = await assertUserExists(db, actorUserId)

  if (actor.role === "admin") {
    return
  }

  if (booking.type === "maintenance" || booking.userId !== actor.id) {
    throw new ForbiddenError("Admins are required for this booking change")
  }
}

async function insertBookingRow(tx: WriteDb, values: typeof bookings.$inferInsert) {
  try {
    await tx.insert(bookings).values(values)
  } catch (error) {
    throwBookingConflictForOverlapAbort(error)
    throw error
  }
}

async function updateBookingRow(
  tx: WriteDb,
  id: string,
  currentUpdatedAt: Date,
  values: Omit<typeof bookings.$inferInsert, "id" | "createdAt" | "deletedAt">,
) {
  try {
    return await tx
      .update(bookings)
      .set(values)
      .where(
        and(
          eq(bookings.id, id),
          isNull(bookings.deletedAt),
          eq(bookings.updatedAt, currentUpdatedAt),
        ),
      )
      .returning()
  } catch (error) {
    throwBookingConflictForOverlapAbort(error)
    throw error
  }
}

function throwBookingConflictForOverlapAbort(error: unknown) {
  if (String(error).includes("booking_overlap")) {
    throw new BookingConflictError()
  }
}

function nextVersionDate(previous: Date) {
  const previousSecond = Math.floor(previous.getTime() / 1000)
  const nowSecond = Math.floor(Date.now() / 1000)
  const nextSecond = nowSecond <= previousSecond ? previousSecond + 1 : nowSecond
  return new Date(nextSecond * 1000)
}
