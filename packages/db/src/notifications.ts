import { and, asc, eq, gt, isNull, lte } from "drizzle-orm"
import type { Db } from "."
import { bookings, machines, notificationDeliveries, users } from "./schema"

export type NotificationKind =
  | "booking_created"
  | "booking_updated"
  | "booking_deleted"
  | "booking_start_reminder"
  | "booking_ending_reminder"

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect

export async function getBookingNotificationContext(db: Db, bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      user: users,
      machine: machines,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(machines, eq(bookings.machineId, machines.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)

  return rows[0] ?? null
}

export async function enqueueDueBookingReminders(
  db: Db,
  input: { startReminderMinutes: number; endingReminderMinutes: number; now?: Date },
) {
  const now = input.now ?? new Date()
  const startUntil = new Date(now.getTime() + input.startReminderMinutes * 60_000)
  const endingUntil = new Date(now.getTime() + input.endingReminderMinutes * 60_000)

  const [startingSoon, endingSoon] = await Promise.all([
    listReminderCandidates(db, {
      kind: "booking_start_reminder",
      field: "startsAt",
      after: now,
      until: startUntil,
    }),
    listReminderCandidates(db, {
      kind: "booking_ending_reminder",
      field: "endsAt",
      after: now,
      until: endingUntil,
    }),
  ])

  await Promise.all(
    [...startingSoon, ...endingSoon].map((candidate) =>
      enqueueNotificationDelivery(db, {
        kind: candidate.kind,
        bookingId: candidate.bookingId,
        recipientEmail: candidate.recipientEmail,
        scheduledFor: now,
      }),
    ),
  )
}

export async function enqueueNotificationDelivery(
  db: Db,
  input: {
    kind: NotificationKind
    bookingId: string
    recipientEmail: string
    scheduledFor: Date
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  await db
    .insert(notificationDeliveries)
    .values({
      id: crypto.randomUUID(),
      idempotencyKey: notificationIdempotencyKey(input.kind, input.bookingId, input.recipientEmail),
      bookingId: input.bookingId,
      recipientEmail: input.recipientEmail,
      kind: input.kind,
      status: "pending",
      error: null,
      scheduledFor: input.scheduledFor,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: notificationDeliveries.idempotencyKey })
}

export async function listDueNotificationDeliveries(db: Db, now = new Date(), limit = 25) {
  return db
    .select()
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.status, "pending"),
        lte(notificationDeliveries.scheduledFor, now),
      ),
    )
    .orderBy(asc(notificationDeliveries.scheduledFor))
    .limit(limit)
}

export async function markNotificationSent(db: Db, id: string, now = new Date()) {
  await db
    .update(notificationDeliveries)
    .set({ status: "sent", sentAt: now, error: null, updatedAt: now })
    .where(eq(notificationDeliveries.id, id))
}

export async function markNotificationFailed(db: Db, id: string, error: string, now = new Date()) {
  await db
    .update(notificationDeliveries)
    .set({ status: "failed", error, updatedAt: now })
    .where(eq(notificationDeliveries.id, id))
}

async function listReminderCandidates(
  db: Db,
  input: {
    kind: Extract<NotificationKind, "booking_start_reminder" | "booking_ending_reminder">
    field: "startsAt" | "endsAt"
    after: Date
    until: Date
  },
) {
  const targetColumn = input.field === "startsAt" ? bookings.startsAt : bookings.endsAt
  const rows = await db
    .select({
      bookingId: bookings.id,
      recipientEmail: users.email,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        gt(targetColumn, input.after),
        lte(targetColumn, input.until),
      ),
    )

  return rows.map((row) => ({ ...row, kind: input.kind }))
}

function notificationIdempotencyKey(
  kind: NotificationKind,
  bookingId: string,
  recipientEmail: string,
) {
  return `${kind}:${bookingId}:${recipientEmail}`
}
