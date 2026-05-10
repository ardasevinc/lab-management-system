import { and, asc, eq, gt, isNull, lt, ne } from "drizzle-orm"
import type { Db } from "."
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

export class BookingConflictError extends Error {
  constructor() {
    super("Booking overlaps an existing booking")
    this.name = "BookingConflictError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class InvalidBookingRangeError extends Error {
  constructor() {
    super("Booking end time must be after start time")
    this.name = "InvalidBookingRangeError"
  }
}

export async function seedInitialData(db: Db, now = new Date()) {
  await db
    .insert(users)
    .values([
      {
        id: "admin-local",
        email: "admin@miralab.tr",
        name: "MIRALAB Admin",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "member-local",
        email: "member@miralab.tr",
        name: "MIRALAB Member",
        role: "member",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(machines)
    .values({
      id: "tohum",
      slug: "tohum",
      name: "tohum",
      description: "MIRALAB GPU workstation for remote AI training and research sessions.",
      specsJson: JSON.stringify(["NVIDIA GPU workstation"]),
      accessNotes: "Remote access details are shared by lab admins.",
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: machines.id,
      set: {
        slug: "tohum",
        name: "tohum",
        description: "MIRALAB GPU workstation for remote AI training and research sessions.",
        specsJson: JSON.stringify(["NVIDIA GPU workstation"]),
        accessNotes: "Remote access details are shared by lab admins.",
        active: true,
        updatedAt: now,
      },
    })
}

export async function listMachines(db: Db) {
  const rows = await db.select().from(machines).orderBy(asc(machines.name))
  return rows.map(mapMachine)
}

export async function getMachineBySlug(db: Db, slug: string) {
  const row = await db.query.machines.findFirst({
    where: eq(machines.slug, slug),
  })
  return row ? mapMachine(row) : null
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
    await assertMachineExists(tx, input.machineId)
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

function mapMachine(row: typeof machines.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    specs: parseSpecs(row.specsJson),
    accessNotes: row.accessNotes,
    active: row.active,
  }
}

function mapBooking(row: typeof bookings.$inferSelect) {
  return {
    id: row.id,
    machineId: row.machineId,
    userId: row.userId,
    title: row.title,
    notes: row.notes,
    type: row.type,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  }
}

function parseSpecs(value: string) {
  const parsed: unknown = JSON.parse(value)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : []
}
