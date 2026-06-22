import { isAbsolute } from "node:path"

export type ApiRuntimeConfig = {
  appEnv: "development" | "production" | "test"
  publicAppUrl: string
  corsOrigins: string[]
  sessionCookieSecure: boolean
  sessionCookieDomain?: string
  devShowOtp: boolean
  otpRateLimitWindowSeconds: number
  otpRateLimitMaxRequests: number
  allowedEmailDomains: string[]
}

export type NotificationWorkerConfig = {
  enabled: boolean
  intervalSeconds: number
  startReminderMinutes: number
  endingReminderMinutes: number
  retryDelayMinutes: number
  maxAttempts: number
}

export type BootstrapAdminConfig = {
  email: string
  name: string
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
  const environment = appEnvFromEnv(env)
  const config = {
    appEnv: environment,
    publicAppUrl: originFromEnv(env.PUBLIC_APP_URL ?? "http://localhost:5173", "PUBLIC_APP_URL", {
      requireHttps: environment === "production",
    }),
    corsOrigins: splitCsv(env.CORS_ORIGINS ?? "http://localhost:5173").map((origin) =>
      originFromEnv(origin, "CORS_ORIGINS", { requireHttps: environment === "production" }),
    ),
    sessionCookieSecure: env.SESSION_COOKIE_SECURE === "1",
    sessionCookieDomain: emptyToUndefined(env.SESSION_COOKIE_DOMAIN),
    devShowOtp: env.DEV_SHOW_OTP === "1",
    otpRateLimitWindowSeconds: positiveIntegerFromEnv(
      env.OTP_RATE_LIMIT_WINDOW_SECONDS,
      "OTP_RATE_LIMIT_WINDOW_SECONDS",
      900,
      false,
    ),
    otpRateLimitMaxRequests: positiveIntegerFromEnv(
      env.OTP_RATE_LIMIT_MAX_REQUESTS,
      "OTP_RATE_LIMIT_MAX_REQUESTS",
      5,
      false,
    ),
    allowedEmailDomains: domainsFromEnv(env.ALLOWED_EMAIL_DOMAINS),
  }

  assertValidRuntimeConfig(config)
  return config
}

export function bootstrapAdminFromEnv(
  env: Record<string, string | undefined>,
): BootstrapAdminConfig | null {
  const appEnvironment = appEnvFromEnv(env)
  const email = emptyToUndefined(env.BOOTSTRAP_ADMIN_EMAIL)
  const name = emptyToUndefined(env.BOOTSTRAP_ADMIN_NAME)
  const allowedEmailDomains = domainsFromEnv(env.ALLOWED_EMAIL_DOMAINS)

  if (!email) {
    if (appEnvironment === "production") {
      return null
    }

    return {
      email: "admin@miralab.tr",
      name: "MIRALAB Admin",
    }
  }

  const normalizedEmail = emailAddressFromEnv(email, "BOOTSTRAP_ADMIN_EMAIL")
  assertEmailAllowedByDomains(normalizedEmail, allowedEmailDomains, "BOOTSTRAP_ADMIN_EMAIL")

  return {
    email: normalizedEmail,
    name: name ?? defaultNameForEmail(normalizedEmail),
  }
}

export function assertEmailAllowedByDomains(
  email: string,
  allowedEmailDomains: string[],
  label = "Email",
) {
  if (!isEmailAllowedByDomains(email, allowedEmailDomains)) {
    throw new Error(`${label} domain is not allowed`)
  }
}

export function isEmailAllowedByDomains(email: string, allowedEmailDomains: string[]) {
  if (!allowedEmailDomains.length) {
    return true
  }

  const domain = emailDomain(email)
  return Boolean(
    domain &&
      allowedEmailDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`)),
  )
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
    retryDelayMinutes: positiveIntegerFromEnv(
      env.NOTIFICATION_RETRY_DELAY_MINUTES,
      "NOTIFICATION_RETRY_DELAY_MINUTES",
      5,
      enabled,
    ),
    maxAttempts: positiveIntegerFromEnv(
      env.NOTIFICATION_MAX_ATTEMPTS,
      "NOTIFICATION_MAX_ATTEMPTS",
      3,
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

  if (!config.corsOrigins.includes(config.publicAppUrl)) {
    throw new Error("CORS_ORIGINS must include PUBLIC_APP_URL in production")
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

function domainsFromEnv(value: string | undefined) {
  return splitCsv(value ?? "").map((domain) => normalizeDomain(domain))
}

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/^@/, "")

  if (!domain || domain.includes("..") || /[^a-z0-9.-]/.test(domain) || !domain.includes(".")) {
    throw new Error("ALLOWED_EMAIL_DOMAINS must contain valid domain names")
  }

  return domain
}

function emailAddressFromEnv(value: string, name: "BOOTSTRAP_ADMIN_EMAIL") {
  const email = value.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${name} must be a valid email address`)
  }

  return email
}

function emailDomain(email: string) {
  return email.split("@").at(1)?.toLowerCase()
}

function defaultNameForEmail(email: string) {
  return email.split("@")[0] || "Lab Admin"
}

function originFromEnv(
  value: string,
  name: "PUBLIC_APP_URL" | "CORS_ORIGINS",
  input: { requireHttps: boolean },
) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL origin`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http or https`)
  }

  if (input.requireHttps && url.protocol !== "https:") {
    throw new Error(`${name} must be HTTPS in production`)
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an origin without path, query, or hash`)
  }

  return url.origin
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
