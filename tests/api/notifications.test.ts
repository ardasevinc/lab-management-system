import { createBooking, enqueueNotificationDelivery, updateUserAccess } from "@lab/db"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BookingEmail } from "../../apps/api/src/mailer"
import { processBookingReminders, startNotificationWorker } from "../../apps/api/src/notifications"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  testDb = await createTestDb()
})

afterEach(() => {
  vi.useRealTimers()
  testDb.close()
})

describe("booking notifications", () => {
  it("sends start reminders once", async () => {
    const sentSubjects: string[] = []
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Reminder run",
      startsAt: new Date("2026-05-10T10:10:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: { subject: string }) {
        sentSubjects.push(email.subject)
      },
    }

    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })
    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })

    expect(sentSubjects).toEqual(["MIRALAB booking starting soon: Reminder run"])
  })

  it("sends ending reminders once", async () => {
    const sentSubjects: string[] = []
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Ending run",
      startsAt: new Date("2026-05-10T09:00:00.000Z"),
      endsAt: new Date("2026-05-10T10:10:00.000Z"),
    })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: { subject: string }) {
        sentSubjects.push(email.subject)
      },
    }

    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })
    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })

    expect(sentSubjects).toEqual(["MIRALAB booking ending soon: Ending run"])
  })

  it("does not enqueue reminders for disabled users", async () => {
    const sentSubjects: string[] = []
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Disabled reminder run",
      startsAt: new Date("2026-05-10T10:10:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })
    await updateUserAccess(testDb.db, "member-local", { active: false })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: { subject: string }) {
        sentSubjects.push(email.subject)
      },
    }

    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })

    const deliveries = await testDb.db.query.notificationDeliveries.findMany()
    expect(sentSubjects).toEqual([])
    expect(deliveries).toEqual([])
  })

  it("does not send pending reminders after the recipient is disabled", async () => {
    const sentSubjects: string[] = []
    const booking = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Queued disabled reminder run",
      startsAt: new Date("2026-05-10T10:10:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })
    await enqueueNotificationDelivery(testDb.db, {
      kind: "booking_start_reminder",
      bookingId: booking.id,
      recipientEmail: "member@miralab.tr",
      scheduledFor: new Date("2026-05-10T10:00:00.000Z"),
    })
    await updateUserAccess(testDb.db, "member-local", { active: false })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: { subject: string }) {
        sentSubjects.push(email.subject)
      },
    }

    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })

    const delivery = await testDb.db.query.notificationDeliveries.findFirst()
    expect(sentSubjects).toEqual([])
    expect(delivery).toEqual(
      expect.objectContaining({
        status: "failed",
        error: "Booking reminder context not available",
      }),
    )
  })

  it("formats booking email details in the lab timezone", async () => {
    const sentEmails: BookingEmail[] = []
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Timezone run",
      startsAt: new Date("2026-05-10T10:10:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: BookingEmail) {
        sentEmails.push(email)
      },
    }

    await processBookingReminders(testDb.db, mailer, {
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      now: new Date("2026-05-10T10:00:00.000Z"),
    })

    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].details).toEqual([
      { label: "Machine", value: "tohum" },
      { label: "Title", value: "Timezone run" },
      { label: "Starts", value: "May 10, 2026, 1:10 PM Europe/Istanbul" },
      { label: "Ends", value: "May 10, 2026, 2:00 PM Europe/Istanbul" },
    ])
    expect(sentEmails[0]).toEqual(
      expect.objectContaining({
        actionLabel: "Open schedule",
        actionUrl: "https://miralab.tr/schedule",
      }),
    )
  })

  it("does not overlap worker runs while a send is still in flight", async () => {
    vi.useFakeTimers()
    const sentSubjects: string[] = []
    let releaseSend: (() => void) | null = null

    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Slow reminder run",
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
    })

    const mailer = {
      async sendLoginOtp() {},
      async sendBookingEmail(email: { subject: string }) {
        sentSubjects.push(email.subject)
        await new Promise<void>((resolve) => {
          releaseSend = resolve
        })
      },
    }

    const timer = startNotificationWorker(testDb.db, mailer, {
      intervalSeconds: 1,
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
    })

    await vi.waitFor(() => {
      expect(sentSubjects).toEqual(["MIRALAB booking starting soon: Slow reminder run"])
    })

    await vi.advanceTimersByTimeAsync(3_000)
    expect(sentSubjects).toEqual(["MIRALAB booking starting soon: Slow reminder run"])

    releaseSend?.()
    await vi.advanceTimersByTimeAsync(1)
    clearInterval(timer)
  })
})
