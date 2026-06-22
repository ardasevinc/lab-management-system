import config from "../../../lab.config"
import type { LabConfig } from "./schema"

export type { LabConfig } from "./schema"

export const labConfig: LabConfig = resolveLabConfig(config, publicEnv())

type PublicEnv = Record<string, string | undefined>

function resolveLabConfig(baseConfig: LabConfig, env: PublicEnv): LabConfig {
  return {
    ...baseConfig,
    appTitle: envValue(env, "APP_TITLE") ?? baseConfig.appTitle,
    labName: envValue(env, "LAB_NAME") ?? baseConfig.labName,
    institutionName: envValue(env, "INSTITUTION_NAME") ?? baseConfig.institutionName,
    shortName: envValue(env, "SHORT_NAME") ?? baseConfig.shortName,
    baseUrl: envValue(env, "BASE_URL") ?? baseConfig.baseUrl,
    logoPath: envValue(env, "LOGO_PATH") ?? baseConfig.logoPath,
    faviconPath: envValue(env, "FAVICON_PATH") ?? baseConfig.faviconPath,
    primaryColor: envValue(env, "PRIMARY_COLOR") ?? baseConfig.primaryColor,
    defaultTimezone: envValue(env, "TIMEZONE") ?? baseConfig.defaultTimezone,
    authHero: {
      eyebrow: envValue(env, "AUTH_EYEBROW") ?? baseConfig.authHero.eyebrow,
      headline: envValue(env, "AUTH_HEADLINE") ?? baseConfig.authHero.headline,
    },
    email: {
      fromName: envValue(env, "EMAIL_FROM_NAME") ?? baseConfig.email.fromName,
      fromAddress: envValue(env, "EMAIL_FROM_ADDRESS") ?? baseConfig.email.fromAddress,
      supportAddress: envValue(env, "EMAIL_SUPPORT_ADDRESS") ?? baseConfig.email.supportAddress,
    },
  }
}

function envValue(env: PublicEnv, key: string) {
  return nonEmpty(env[`VITE_LAB_${key}`]) ?? nonEmpty(env[`LAB_${key}`])
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function publicEnv(): PublicEnv {
  const runtimeEnv = (globalThis as { Bun?: { env?: PublicEnv } }).Bun?.env ?? {}
  const viteEnv = (import.meta as ImportMeta & { env?: PublicEnv }).env ?? {}
  return { ...runtimeEnv, ...viteEnv }
}
