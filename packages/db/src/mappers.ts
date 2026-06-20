import type { bookingAuditEvents, bookings, machines, users } from "./schema"

export function mapUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
  }
}

export function mapMachine(row: typeof machines.$inferSelect) {
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

export function mapBooking(row: typeof bookings.$inferSelect) {
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

export function mapAuditEvent(row: typeof bookingAuditEvents.$inferSelect) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    actorUserId: row.actorUserId,
    eventType: row.eventType,
    reason: row.reason,
    payload: parsePayload(row.payloadJson),
    createdAt: row.createdAt.toISOString(),
  }
}

function parseSpecs(value: string) {
  const parsed: unknown = JSON.parse(value)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : []
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}
