import { labConfig } from "@lab/config"
import {
  type Db,
  enqueueDueBookingReminders,
  getBookingNotificationContext,
  listDueNotificationDeliveries,
  markNotificationFailed,
  markNotificationSent,
  type NotificationKind,
} from "@lab/db"
import type { BookingEmail, Mailer } from "./mailer"

type BookingNotificationContext = NonNullable<
  Awaited<ReturnType<typeof getBookingNotificationContext>>
>

export async function sendBookingNotification(
  db: Db,
  mailer: Mailer,
  input: { bookingId: string; kind: NotificationKind },
) {
  const context = await getBookingNotificationContext(db, input.bookingId)
  if (!context) {
    return
  }

  await mailer.sendBookingEmail(bookingEmailForKind(context, input.kind))
}

export async function processBookingReminders(
  db: Db,
  mailer: Mailer,
  input: { startReminderMinutes: number; endingReminderMinutes: number; now?: Date },
) {
  const now = input.now ?? new Date()
  await enqueueDueBookingReminders(db, {
    startReminderMinutes: input.startReminderMinutes,
    endingReminderMinutes: input.endingReminderMinutes,
    now,
  })

  const dueDeliveries = await listDueNotificationDeliveries(db, now)
  for (const delivery of dueDeliveries) {
    try {
      const context = delivery.bookingId
        ? await getBookingNotificationContext(db, delivery.bookingId)
        : null

      if (!context) {
        await markNotificationFailed(db, delivery.id, "Booking not found", now)
        continue
      }

      await mailer.sendBookingEmail(bookingEmailForKind(context, delivery.kind))
      await markNotificationSent(db, delivery.id, now)
    } catch (error) {
      await markNotificationFailed(db, delivery.id, errorMessage(error), now)
    }
  }
}

export function startNotificationWorker(
  db: Db,
  mailer: Mailer,
  input: {
    intervalSeconds: number
    startReminderMinutes: number
    endingReminderMinutes: number
  },
) {
  let inFlight: Promise<void> | null = null

  const run = () => {
    if (inFlight) {
      return inFlight
    }

    inFlight = processBookingReminders(db, mailer, input)
      .catch((error) => {
        console.error("[lab-api] notification worker failed", error)
      })
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  void run()
  return setInterval(run, input.intervalSeconds * 1000)
}

function bookingEmailForKind(
  context: BookingNotificationContext,
  kind: NotificationKind,
): BookingEmail {
  const details = bookingDetails(context)

  switch (kind) {
    case "booking_created":
      return {
        to: context.user.email,
        subject: `MIRALAB booking created: ${context.booking.title}`,
        headline: "Booking created",
        body: `Your ${context.machine.name} booking has been created.`,
        details,
      }
    case "booking_updated":
      return {
        to: context.user.email,
        subject: `MIRALAB booking updated: ${context.booking.title}`,
        headline: "Booking updated",
        body: `Your ${context.machine.name} booking has been updated.`,
        details,
      }
    case "booking_deleted":
      return {
        to: context.user.email,
        subject: `MIRALAB booking deleted: ${context.booking.title}`,
        headline: "Booking deleted",
        body: `Your ${context.machine.name} booking has been deleted.`,
        details,
      }
    case "booking_start_reminder":
      return {
        to: context.user.email,
        subject: `MIRALAB booking starting soon: ${context.booking.title}`,
        headline: "Booking starting soon",
        body: `Your ${context.machine.name} booking starts soon.`,
        details,
      }
    case "booking_ending_reminder":
      return {
        to: context.user.email,
        subject: `MIRALAB booking ending soon: ${context.booking.title}`,
        headline: "Booking ending soon",
        body: `Your ${context.machine.name} booking ends soon.`,
        details,
      }
  }
}

function bookingDetails(context: BookingNotificationContext) {
  return [
    { label: "Machine", value: context.machine.name },
    { label: "Title", value: context.booking.title },
    { label: "Starts", value: formatLabTimezone(context.booking.startsAt) },
    { label: "Ends", value: formatLabTimezone(context.booking.endsAt) },
  ]
}

function formatLabTimezone(date: Date) {
  const formatted = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: labConfig.defaultTimezone,
  })

  return `${formatted} ${labConfig.defaultTimezone}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
