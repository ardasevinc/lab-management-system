import { isAbsolute } from "node:path"
import {
  apiRuntimeConfigFromEnv,
  bootstrapAdminFromEnv,
  databaseUrlFromEnv,
  notificationWorkerConfigFromEnv,
} from "../apps/api/src/env"
import { createMailerFromEnv } from "../apps/api/src/mailer"

const options = parseArgs(Bun.argv.slice(2))
const envPath = options.envPath ?? "deploy/caprover.env.example"
const env = parseEnvFile(await Bun.file(envPath).text())

apiRuntimeConfigFromEnv(env)
databaseUrlFromEnv(env, "")
notificationWorkerConfigFromEnv(env)
createMailerFromEnv(env)

assertEnv("APP_ENV", "production")
assertEnv("NODE_ENV", "production")
assertEnv("PORT", "3001")
assertEnv("SERVE_WEB", "1")
assertEnv("DEV_SHOW_OTP", "0")
assertEnv("EMAIL_PROVIDER", "ses")
assertEnv("REMINDERS_ENABLED", "1")
assertEnv("PUBLIC_APP_URL", "https://lms.miralab.tr")
assertEnv("CORS_ORIGINS", "https://lms.miralab.tr")
assertEnv("SESSION_COOKIE_SECURE", "1")
assertEnv("SESSION_COOKIE_DOMAIN", "")
assertEnv("VITE_LAB_APP_TITLE", "MIRALAB")
assertEnv("VITE_LAB_SHORT_NAME", "MIRALAB")
assertEnv("VITE_LAB_LAB_NAME", "Machine Intelligence Research and Applications Lab")
assertEnv("VITE_LAB_INSTITUTION_NAME", "Izmir Institute of Technology")
assertEnv("VITE_LAB_BASE_URL", "https://lms.miralab.tr")
assertEnv("VITE_LAB_LOGO_PATH", "/logo.svg")
assertEnv("VITE_LAB_FAVICON_PATH", "/favicon.svg")
assertEnv("VITE_LAB_PRIMARY_COLOR", "#007f67")
assertEnv("VITE_LAB_TIMEZONE", "Europe/Istanbul")
assertEnv("VITE_LAB_AUTH_EYEBROW", "GPU workstation access")
assertEnv("VITE_LAB_AUTH_HEADLINE", "Book tohum for research runs.")
assertEnv("VITE_LAB_EMAIL_FROM_NAME", "MIRALAB")
assertEnv("VITE_LAB_EMAIL_FROM_ADDRESS", "no-reply@miralab.tr")
assertEnv("VITE_LAB_EMAIL_SUPPORT_ADDRESS", "support@miralab.tr")
assertEnv("DATABASE_URL", "file:/app/data/lab.sqlite")
assertEnv("WEB_DIST_DIR", "/app/apps/web/dist")
assertEnv("ALLOWED_EMAIL_DOMAINS", "")
assertEnv("OTP_RATE_LIMIT_WINDOW_SECONDS", "900")
assertEnv("OTP_RATE_LIMIT_MAX_REQUESTS", "5")
assertEnv("AWS_REGION", "eu-central-1")
assertEnv("SES_FROM_NAME", "MIRALAB")
assertEnv("SES_FROM_EMAIL", "no-reply@miralab.tr")
assertEnv("SES_REPLY_TO", "support@miralab.tr")
assertEnv("SES_CONFIGURATION_SET", "miralab-lms")
assertEnv("BOOKING_START_REMINDER_MINUTES", "15")
assertEnv("BOOKING_ENDING_REMINDER_MINUTES", "15")
assertEnv("NOTIFICATION_WORKER_INTERVAL_SECONDS", "60")
assertEnv("NOTIFICATION_RETRY_DELAY_MINUTES", "5")
assertEnv("NOTIFICATION_MAX_ATTEMPTS", "3")
assertEnv("BACKUP_DATABASE_PATH", "/app/data/lab.sqlite")
assertEnv("BACKUP_DIR", "/app/data/backups")
assertEnv("BACKUP_RETENTION_DAYS", "30")

assertAbsolutePathEnv("WEB_DIST_DIR")
assertAbsolutePathEnv("BACKUP_DATABASE_PATH")
assertAbsolutePathEnv("BACKUP_DIR")
assertSameSqlitePath()
if (options.realSecrets) {
  assertMaterializedSecret("BOOTSTRAP_ADMIN_EMAIL")
  assertMaterializedSecret("BOOTSTRAP_ADMIN_NAME")
  assertMaterializedSecret("AWS_ACCESS_KEY_ID")
  assertMaterializedSecret("AWS_SECRET_ACCESS_KEY")

  if (!bootstrapAdminFromEnv(env)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be materialized for real-secret env verification")
  }
} else {
  assertPlaceholderSecret("BOOTSTRAP_ADMIN_EMAIL")
  assertPlaceholderSecret("BOOTSTRAP_ADMIN_NAME")
  assertPlaceholderSecret("AWS_ACCESS_KEY_ID")
  assertPlaceholderSecret("AWS_SECRET_ACCESS_KEY")
}

console.log(`verified CapRover env template: ${envPath}`)

function parseArgs(args: string[]) {
  const parsed: { envPath?: string; realSecrets: boolean } = { realSecrets: false }

  for (const arg of args) {
    if (arg === "--real-secrets") {
      parsed.realSecrets = true
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (parsed.envPath) {
      throw new Error(`Unexpected extra argument: ${arg}`)
    }

    parsed.envPath = arg
  }

  return parsed
}

function parseEnvFile(contents: string) {
  const parsed: Record<string, string> = {}

  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const equalsIndex = line.indexOf("=")
    if (equalsIndex <= 0) {
      throw new Error(`Invalid env line ${index + 1}: ${rawLine}`)
    }

    const key = line.slice(0, equalsIndex).trim()
    const value = line.slice(equalsIndex + 1).trim()
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`Invalid env key on line ${index + 1}: ${key}`)
    }

    parsed[key] = value
  }

  return parsed
}

function assertEnv(key: string, expected: string) {
  if (env[key] !== expected) {
    throw new Error(`${key} must be ${expected}`)
  }
}

function assertAbsolutePathEnv(key: string) {
  const value = env[key]
  if (!value || !isAbsolute(value)) {
    throw new Error(`${key} must be an absolute path`)
  }
}

function assertSameSqlitePath() {
  const databaseUrl = env.DATABASE_URL
  const backupDatabasePath = env.BACKUP_DATABASE_PATH
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must use file: SQLite storage")
  }

  if (databaseUrl.slice("file:".length) !== backupDatabasePath) {
    throw new Error("BACKUP_DATABASE_PATH must match DATABASE_URL")
  }
}

function assertPlaceholderSecret(key: string) {
  if (env[key] !== "<set-in-caprover>") {
    throw new Error(`${key} must stay as <set-in-caprover> in deploy/caprover.env.example`)
  }
}

function assertMaterializedSecret(key: string) {
  const value = env[key]
  if (!value || value === "<set-in-caprover>") {
    throw new Error(`${key} must be materialized for real-secret env verification`)
  }
}
