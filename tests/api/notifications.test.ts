import { createBooking } from "@lab/db"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { processBookingReminders } from "../../apps/api/src/notifications"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  testDb = await createTestDb()
})

afterEach(() => {
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
})
