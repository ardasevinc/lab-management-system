export type ApiRuntimeConfig = {
  appEnv: "development" | "production" | "test"
  publicAppUrl: string
  corsOrigins: string[]
  sessionCookieSecure: boolean
  sessionCookieDomain?: string
  devShowOtp: boolean
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
