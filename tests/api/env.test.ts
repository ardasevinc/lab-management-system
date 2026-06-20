import { describe, expect, it } from "vitest"
import { apiRuntimeConfigFromEnv, notificationWorkerConfigFromEnv } from "../../apps/api/src/env"

describe("api runtime env", () => {
  it("accepts local development defaults", () => {
    expect(apiRuntimeConfigFromEnv({})).toEqual({
      appEnv: "development",
      publicAppUrl: "http://localhost:5173",
      corsOrigins: ["http://localhost:5173"],
      sessionCookieSecure: false,
      sessionCookieDomain: undefined,
      devShowOtp: false,
    })
  })

  it("rejects dev OTP exposure in production", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        APP_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://lms.miralab.tr",
        SESSION_COOKIE_SECURE: "1",
        DEV_SHOW_OTP: "1",
      }),
    ).toThrow("DEV_SHOW_OTP must be disabled in production")
  })

  it("requires secure production cookies", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        APP_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://lms.miralab.tr",
      }),
    ).toThrow("SESSION_COOKIE_SECURE=1 is required in production")
  })

  it("parses disabled notification worker defaults", () => {
    expect(notificationWorkerConfigFromEnv({})).toEqual({
      enabled: false,
      intervalSeconds: 60,
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
    })
  })

  it("parses enabled notification worker config", () => {
    expect(
      notificationWorkerConfigFromEnv({
        REMINDERS_ENABLED: "1",
        NOTIFICATION_WORKER_INTERVAL_SECONDS: "30",
        BOOKING_START_REMINDER_MINUTES: "20",
        BOOKING_ENDING_REMINDER_MINUTES: "10",
      }),
    ).toEqual({
      enabled: true,
      intervalSeconds: 30,
      startReminderMinutes: 20,
      endingReminderMinutes: 10,
    })
  })

  it("rejects invalid notification worker numbers", () => {
    expect(() =>
      notificationWorkerConfigFromEnv({
        REMINDERS_ENABLED: "1",
        NOTIFICATION_WORKER_INTERVAL_SECONDS: "soon",
      }),
    ).toThrow("NOTIFICATION_WORKER_INTERVAL_SECONDS must be a positive integer")

    expect(() =>
      notificationWorkerConfigFromEnv({
        REMINDERS_ENABLED: "1",
        BOOKING_START_REMINDER_MINUTES: "0",
      }),
    ).toThrow("BOOKING_START_REMINDER_MINUTES must be a positive integer")
  })
})
