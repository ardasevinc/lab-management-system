import { asc, eq } from "drizzle-orm"
import type { Db } from "."
import { mapAuditEvent } from "./mappers"
import { bookingAuditEvents } from "./schema"

type AuditDb = Pick<Db, "insert" | "select">

export type BookingAuditEventType = "created" | "updated" | "deleted" | "admin_override"

export async function listBookingAuditEvents(db: Db, bookingId: string) {
  const rows = await db
    .select()
    .from(bookingAuditEvents)
    .where(eq(bookingAuditEvents.bookingId, bookingId))
    .orderBy(asc(bookingAuditEvents.createdAt))

  return rows.map(mapAuditEvent)
}

export async function insertBookingAudit(
  db: AuditDb,
  input: {
    bookingId: string
    actorUserId: string
    eventType: BookingAuditEventType
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
