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

export function apiRuntimeConfigFromEnv(env: Record<string, string | undefined>): ApiRuntimeConfig {
  const config = {
    appEnv: appEnv(env.APP_ENV),
    publicAppUrl: env.PUBLIC_APP_URL ?? "http://localhost:5173",
    corsOrigins: splitCsv(env.CORS_ORIGINS ?? "http://localhost:5173"),
    sessionCookieSecure: env.SESSION_COOKIE_SECURE === "1",
    sessionCookieDomain: emptyToUndefined(env.SESSION_COOKIE_DOMAIN),
    devShowOtp: env.DEV_SHOW_OTP === "1",
  }

  assertValidRuntimeConfig(config)
  return config
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

function appEnv(value: string | undefined): ApiRuntimeConfig["appEnv"] {
  if (value === "production" || value === "test") {
    return value
  }

  return "development"
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
