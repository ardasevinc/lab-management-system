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

  it("normalizes URL origins with trailing slashes", () => {
    expect(
      apiRuntimeConfigFromEnv({
        PUBLIC_APP_URL: "http://localhost:5173/",
        CORS_ORIGINS: "http://localhost:5173/, http://127.0.0.1:5173/",
      }),
    ).toEqual(
      expect.objectContaining({
        publicAppUrl: "http://localhost:5173",
        corsOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
      }),
    )
  })

  it("rejects runtime URL origins with paths, queries, hashes, or non-http schemes", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        PUBLIC_APP_URL: "https://lms.miralab.tr/schedule",
      }),
    ).toThrow("PUBLIC_APP_URL must be an origin without path, query, or hash")

    expect(() =>
      apiRuntimeConfigFromEnv({
        PUBLIC_APP_URL: "mailto:admin@miralab.tr",
      }),
    ).toThrow("PUBLIC_APP_URL must use http or https")

    expect(() =>
      apiRuntimeConfigFromEnv({
        CORS_ORIGINS: "https://lms.miralab.tr?preview=1",
      }),
    ).toThrow("CORS_ORIGINS must be an origin without path, query, or hash")
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

  it("requires public app url in production cors origins", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        APP_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://admin.miralab.tr",
        SESSION_COOKIE_SECURE: "1",
      }),
    ).toThrow("CORS_ORIGINS must include PUBLIC_APP_URL in production")
  })

  it("treats NODE_ENV=production as production", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://lms.miralab.tr",
        SESSION_COOKIE_SECURE: "0",
      }),
    ).toThrow("SESSION_COOKIE_SECURE=1 is required in production")
  })

  it("does not let APP_ENV bypass NODE_ENV=production", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        APP_ENV: "development",
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://lms.miralab.tr",
        SESSION_COOKIE_SECURE: "0",
      }),
    ).toThrow("SESSION_COOKIE_SECURE=1 is required in production")
  })

  it("rejects invalid app environment values", () => {
    expect(() =>
      apiRuntimeConfigFromEnv({
        APP_ENV: "prod",
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://lms.miralab.tr",
        CORS_ORIGINS: "https://lms.miralab.tr",
        SESSION_COOKIE_SECURE: "1",
      }),
    ).toThrow("APP_ENV must be one of: development, production, test")

    expect(() =>
      apiRuntimeConfigFromEnv({
        NODE_ENV: "prod",
      }),
    ).toThrow("NODE_ENV must be one of: development, production, test")
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
      retryDelayMinutes: 5,
      maxAttempts: 3,
    })
  })

  it("parses enabled notification worker config", () => {
    expect(
      notificationWorkerConfigFromEnv({
        REMINDERS_ENABLED: "1",
        NOTIFICATION_WORKER_INTERVAL_SECONDS: "30",
        BOOKING_START_REMINDER_MINUTES: "20",
        BOOKING_ENDING_REMINDER_MINUTES: "10",
        NOTIFICATION_RETRY_DELAY_MINUTES: "7",
        NOTIFICATION_MAX_ATTEMPTS: "4",
      }),
    ).toEqual({
      enabled: true,
      intervalSeconds: 30,
      startReminderMinutes: 20,
      endingReminderMinutes: 10,
      retryDelayMinutes: 7,
      maxAttempts: 4,
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

    expect(() =>
      notificationWorkerConfigFromEnv({
        REMINDERS_ENABLED: "1",
        NOTIFICATION_MAX_ATTEMPTS: "0",
      }),
    ).toThrow("NOTIFICATION_MAX_ATTEMPTS must be a positive integer")
  })
})
