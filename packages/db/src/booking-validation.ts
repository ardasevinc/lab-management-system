import { and, eq, gt, isNull, lt, ne } from "drizzle-orm"
import type { Db } from "."
import { BookingConflictError, InvalidBookingRangeError, NotFoundError } from "./errors"
import { bookings, machines, users } from "./schema"

type QueryDb = Pick<Db, "query">

export function assertValidBookingRange(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new InvalidBookingRangeError()
  }
}

export async function assertNoBookingOverlap(
  db: QueryDb,
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

export async function assertMachineExists(db: QueryDb, id: string) {
  const machine = await db.query.machines.findFirst({ where: eq(machines.id, id) })
  if (!machine) {
    throw new NotFoundError("Machine not found")
  }

  return machine
}

export async function assertMachineBookable(db: QueryDb, id: string) {
  const machine = await assertMachineExists(db, id)

  if (!machine.active) {
    throw new InvalidBookingRangeError("Machine is not bookable")
  }
}

export async function assertUserExists(db: QueryDb, id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!user) {
    throw new NotFoundError("User not found")
  }
}
