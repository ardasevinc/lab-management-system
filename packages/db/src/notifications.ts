import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm"
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

export async function getActiveBookingNotificationContext(db: Db, bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      user: users,
      machine: machines,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .innerJoin(machines, eq(bookings.machineId, machines.id))
    .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt), eq(users.active, true)))
    .limit(1)

  return rows[0] ?? null
}

export async function getBookingNotificationContextForUser(
  db: Db,
  input: { bookingId: string; userId: string },
) {
  const rows = await db
    .select({
      booking: bookings,
      user: users,
      machine: machines,
    })
    .from(bookings)
    .innerJoin(machines, eq(bookings.machineId, machines.id))
    .innerJoin(users, eq(users.id, input.userId))
    .where(eq(bookings.id, input.bookingId))
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
        reminderAt: candidate.reminderAt,
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
    reminderAt?: Date | null
    now?: Date
  },
) {
  const now = input.now ?? new Date()
  await db
    .insert(notificationDeliveries)
    .values({
      id: crypto.randomUUID(),
      idempotencyKey: notificationIdempotencyKey(
        input.kind,
        input.bookingId,
        input.recipientEmail,
        input.reminderAt ?? null,
      ),
      bookingId: input.bookingId,
      recipientEmail: input.recipientEmail,
      kind: input.kind,
      status: "pending",
      error: null,
      scheduledFor: input.scheduledFor,
      reminderAt: input.reminderAt ?? null,
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

export async function claimDueNotificationDeliveries(db: Db, now = new Date(), limit = 25) {
  const staleProcessingBefore = new Date(now.getTime() - 10 * 60_000)
  const candidates = await db
    .select()
    .from(notificationDeliveries)
    .where(
      and(
        lte(notificationDeliveries.scheduledFor, now),
        or(
          eq(notificationDeliveries.status, "pending"),
          and(
            eq(notificationDeliveries.status, "processing"),
            lte(notificationDeliveries.updatedAt, staleProcessingBefore),
          ),
        ),
      ),
    )
    .orderBy(asc(notificationDeliveries.scheduledFor))
    .limit(limit)

  const claimed: NotificationDelivery[] = []
  for (const candidate of candidates) {
    const [delivery] = await db
      .update(notificationDeliveries)
      .set({ status: "processing", updatedAt: now })
      .where(
        and(
          eq(notificationDeliveries.id, candidate.id),
          lte(notificationDeliveries.scheduledFor, now),
          or(
            eq(notificationDeliveries.status, "pending"),
            and(
              eq(notificationDeliveries.status, "processing"),
              lte(notificationDeliveries.updatedAt, staleProcessingBefore),
            ),
          ),
        ),
      )
      .returning()

    if (delivery) {
      claimed.push(delivery)
    }
  }

  return claimed
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

export async function markNotificationCanceled(
  db: Db,
  id: string,
  error: string,
  now = new Date(),
) {
  await db
    .update(notificationDeliveries)
    .set({ status: "canceled", error, updatedAt: now })
    .where(eq(notificationDeliveries.id, id))
}

export async function markNotificationRetryOrFailed(
  db: Db,
  id: string,
  input: {
    error: string
    now?: Date
    retryDelayMinutes: number
    maxAttempts: number
  },
) {
  const now = input.now ?? new Date()
  const [delivery] = await db
    .select({ attemptCount: notificationDeliveries.attemptCount })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, id))
    .limit(1)

  if (!delivery) {
    return
  }

  const attemptCount = delivery.attemptCount + 1
  const shouldRetry = attemptCount < input.maxAttempts
  await db
    .update(notificationDeliveries)
    .set({
      status: shouldRetry ? "pending" : "failed",
      error: input.error,
      attemptCount,
      scheduledFor: shouldRetry ? new Date(now.getTime() + input.retryDelayMinutes * 60_000) : now,
      updatedAt: now,
    })
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
      reminderAt: targetColumn,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(users.active, true),
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
  reminderAt?: Date | null,
) {
  return [kind, bookingId, recipientEmail, reminderAt?.toISOString()].filter(Boolean).join(":")
}
