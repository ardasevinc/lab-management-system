import { asc, desc, eq } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import type { Db } from "."
import { mapAuditEvent, mapBooking, mapMachine, mapUser } from "./mappers"
import { bookingAuditEvents, bookings, machines, users } from "./schema"

type AuditDb = Pick<Db, "insert" | "select">

export type BookingAuditEventType = "created" | "updated" | "deleted" | "admin_override"

const actorUsers = alias(users, "actor_users")
const ownerUsers = alias(users, "owner_users")

export async function listBookingAuditEvents(db: Db, bookingId: string) {
  const rows = await db
    .select()
    .from(bookingAuditEvents)
    .where(eq(bookingAuditEvents.bookingId, bookingId))
    .orderBy(asc(bookingAuditEvents.createdAt))

  return rows.map(mapAuditEvent)
}

export async function listAdminBookingAuditEvents(db: Db, options: { limit?: number } = {}) {
  const limit = clampAuditLimit(options.limit)
  const rows = await db
    .select({
      auditEvent: bookingAuditEvents,
      booking: bookings,
      actor: actorUsers,
      owner: ownerUsers,
      machine: machines,
    })
    .from(bookingAuditEvents)
    .innerJoin(bookings, eq(bookingAuditEvents.bookingId, bookings.id))
    .innerJoin(actorUsers, eq(bookingAuditEvents.actorUserId, actorUsers.id))
    .innerJoin(ownerUsers, eq(bookings.userId, ownerUsers.id))
    .innerJoin(machines, eq(bookings.machineId, machines.id))
    .orderBy(desc(bookingAuditEvents.createdAt))
    .limit(limit)

  return rows.map(({ actor, auditEvent, booking, machine, owner }) => ({
    ...mapAuditEvent(auditEvent),
    actor: mapUser(actor),
    owner: mapUser(owner),
    machine: mapMachine(machine),
    booking: {
      ...mapBooking(booking, owner),
      deletedAt: booking.deletedAt?.toISOString() ?? null,
    },
  }))
}

export async function insertBookingAudit(
  db: AuditDb,
  input: {
    bookingId: string
    actorUserId: string
    eventType: BookingAuditEventType
    reason?: string | null
    payload: unknown
    createdAt?: Date
  },
) {
  await db.insert(bookingAuditEvents).values({
    id: crypto.randomUUID(),
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    reason: input.reason ?? null,
    payloadJson: JSON.stringify(input.payload),
    createdAt: input.createdAt ?? new Date(),
  })
}

function clampAuditLimit(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 100
  }

  return Math.min(Math.max(Math.trunc(value ?? 100), 1), 200)
}
