import { describe, expect, it } from "vitest"
import { apiRuntimeConfigFromEnv } from "../../apps/api/src/env"

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
})
