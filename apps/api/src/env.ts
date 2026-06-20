import { isAbsolute } from "node:path"

export type ApiRuntimeConfig = {
  appEnv: "development" | "production" | "test"
  publicAppUrl: string
  corsOrigins: string[]
  sessionCookieSecure: boolean
  sessionCookieDomain?: string
  devShowOtp: boolean
}

export type NotificationWorkerConfig = {
  enabled: boolean
  intervalSeconds: number
  startReminderMinutes: number
  endingReminderMinutes: number
}

export function databaseUrlFromEnv(
  env: Record<string, string | undefined>,
  defaultDatabaseUrl: string,
) {
  const appEnvironment = appEnvFromEnv(env)
  const databaseUrl = env.DATABASE_URL ?? defaultDatabaseUrl

  assertValidDatabaseUrl(databaseUrl, {
    appEnv: appEnvironment,
    explicitDatabaseUrl: Boolean(env.DATABASE_URL),
  })

  return databaseUrl
}

export function apiRuntimeConfigFromEnv(env: Record<string, string | undefined>): ApiRuntimeConfig {
  const config = {
    appEnv: appEnvFromEnv(env),
    publicAppUrl: env.PUBLIC_APP_URL ?? "http://localhost:5173",
    corsOrigins: splitCsv(env.CORS_ORIGINS ?? "http://localhost:5173"),
    sessionCookieSecure: env.SESSION_COOKIE_SECURE === "1",
    sessionCookieDomain: emptyToUndefined(env.SESSION_COOKIE_DOMAIN),
    devShowOtp: env.DEV_SHOW_OTP === "1",
  }

  assertValidRuntimeConfig(config)
  return config
}

export function appEnvFromEnv(env: Record<string, string | undefined>): ApiRuntimeConfig["appEnv"] {
  const appEnvironment = parseAppEnv(env.APP_ENV, "APP_ENV")
  const nodeEnvironment = parseAppEnv(env.NODE_ENV, "NODE_ENV")

  if (appEnvironment === "production" || nodeEnvironment === "production") {
    return "production"
  }

  return appEnvironment ?? nodeEnvironment ?? "development"
}

export function notificationWorkerConfigFromEnv(
  env: Record<string, string | undefined>,
): NotificationWorkerConfig {
  const enabled = env.REMINDERS_ENABLED === "1"

  return {
    enabled,
    intervalSeconds: positiveIntegerFromEnv(
      env.NOTIFICATION_WORKER_INTERVAL_SECONDS,
      "NOTIFICATION_WORKER_INTERVAL_SECONDS",
      60,
      enabled,
    ),
    startReminderMinutes: positiveIntegerFromEnv(
      env.BOOKING_START_REMINDER_MINUTES,
      "BOOKING_START_REMINDER_MINUTES",
      15,
      enabled,
    ),
    endingReminderMinutes: positiveIntegerFromEnv(
      env.BOOKING_ENDING_REMINDER_MINUTES,
      "BOOKING_ENDING_REMINDER_MINUTES",
      15,
      enabled,
    ),
  }
}

function assertValidRuntimeConfig(config: ApiRuntimeConfig) {
  if (!config.corsOrigins.length) {
    throw new Error("CORS_ORIGINS must include at least one origin")
  }

  if (config.appEnv !== "production") {
    return
  }

  if (config.devShowOtp) {
    throw new Error("DEV_SHOW_OTP must be disabled in production")
  }

  if (!config.sessionCookieSecure) {
    throw new Error("SESSION_COOKIE_SECURE=1 is required in production")
  }

  if (!config.publicAppUrl.startsWith("https://")) {
    throw new Error("PUBLIC_APP_URL must be HTTPS in production")
  }

  for (const origin of config.corsOrigins) {
    if (!origin.startsWith("https://")) {
      throw new Error("CORS_ORIGINS must be HTTPS in production")
    }
  }
}

function assertValidDatabaseUrl(
  databaseUrl: string,
  input: { appEnv: ApiRuntimeConfig["appEnv"]; explicitDatabaseUrl: boolean },
) {
  if (input.appEnv !== "production") {
    return
  }

  if (!input.explicitDatabaseUrl) {
    throw new Error("DATABASE_URL is required in production")
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must use file: SQLite storage in production")
  }

  if (databaseUrl.startsWith("file::memory:")) {
    throw new Error("DATABASE_URL must not use in-memory SQLite in production")
  }

  const databasePath = databaseUrl.replace(/^file:/, "")
  if (!isAbsolute(databasePath)) {
    throw new Error("DATABASE_URL must use an absolute SQLite path in production")
  }
}

function parseAppEnv(
  value: string | undefined,
  name: "APP_ENV" | "NODE_ENV",
): ApiRuntimeConfig["appEnv"] | undefined {
  if (!value) {
    return undefined
  }

  if (value === "development" || value === "production" || value === "test") {
    return value
  }

  throw new Error(`${name} must be one of: development, production, test`)
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function emptyToUndefined(value: string | undefined) {
  return value?.trim() || undefined
}

function positiveIntegerFromEnv(
  value: string | undefined,
  name: string,
  fallback: number,
  required: boolean,
) {
  if (!value) {
    if (required) {
      return fallback
    }

    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}
