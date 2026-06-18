export type ApiRuntimeConfig = {
  corsOrigins: string[]
  sessionCookieSecure: boolean
  sessionCookieDomain?: string
  devShowOtp: boolean
}

export function apiRuntimeConfigFromEnv(env: Record<string, string | undefined>): ApiRuntimeConfig {
  return {
    corsOrigins: splitCsv(env.CORS_ORIGINS ?? "http://localhost:5173"),
    sessionCookieSecure: env.SESSION_COOKIE_SECURE === "1",
    sessionCookieDomain: emptyToUndefined(env.SESSION_COOKIE_DOMAIN),
    devShowOtp: env.DEV_SHOW_OTP === "1",
  }
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
