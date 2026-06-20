import { describe, expect, it } from "vitest"
import {
  apiRuntimeConfigFromEnv,
  databaseUrlFromEnv,
  notificationWorkerConfigFromEnv,
} from "../../apps/api/src/env"

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

  it("treats NODE_ENV=production as production", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        NODE_ENV: "production",
        PUBLIC_APP_URL: "http://localhost:3001",
        CORS_ORIGINS: "http://localhost:3001",
        SESSION_COOKIE_SECURE: "0",
      }),
    ).toThrow("SESSION_COOKIE_SECURE=1 is required in production")
  })

  it("requires an explicit absolute SQLite database path in production", () => {
    const productionEnv = {
      APP_ENV: "production",
    }

    expect(() => databaseUrlFromEnv(productionEnv, "file:/app/default/lab.sqlite")).toThrow(
      "DATABASE_URL is required in production",
    )

    expect(() =>
      databaseUrlFromEnv({ ...productionEnv, DATABASE_URL: "file:./data/lab.sqlite" }, ""),
    ).toThrow("DATABASE_URL must use an absolute SQLite path in production")

    expect(() =>
      databaseUrlFromEnv({ ...productionEnv, DATABASE_URL: "file::memory:" }, ""),
    ).toThrow("DATABASE_URL must not use in-memory SQLite in production")

    expect(() =>
      databaseUrlFromEnv({ ...productionEnv, DATABASE_URL: "libsql://example.turso.io" }, ""),
    ).toThrow("DATABASE_URL must use file: SQLite storage in production")

    expect(
      databaseUrlFromEnv({ ...productionEnv, DATABASE_URL: "file:/app/data/lab.sqlite" }, ""),
    ).toBe("file:/app/data/lab.sqlite")
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
