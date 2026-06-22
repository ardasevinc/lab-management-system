import { mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = fileURLToPath(new URL("..", import.meta.url))
const port = Bun.env.PORT ?? "4173"
const publicAppUrl = `http://127.0.0.1:${port}`
const dbPath = join(rootDir, ".tmp", "e2e", "lab.sqlite")

mkdirSync(dirname(dbPath), { recursive: true })
rmSync(dbPath, { force: true })
rmSync(`${dbPath}-shm`, { force: true })
rmSync(`${dbPath}-wal`, { force: true })

Bun.env.APP_ENV = "development"
Bun.env.PORT = port
Bun.env.PUBLIC_APP_URL = publicAppUrl
Bun.env.CORS_ORIGINS = publicAppUrl
Bun.env.SESSION_COOKIE_SECURE = "0"
Bun.env.DEV_SHOW_OTP = "1"
Bun.env.OTP_RATE_LIMIT_WINDOW_SECONDS = "900"
Bun.env.OTP_RATE_LIMIT_MAX_REQUESTS = "100"
Bun.env.DATABASE_URL = `file:${dbPath}`
Bun.env.SERVE_WEB = "1"
Bun.env.WEB_DIST_DIR = join(rootDir, "apps/web/dist")
Bun.env.EMAIL_PROVIDER = "console"
Bun.env.REMINDERS_ENABLED = "0"

const serverModule = await import("../apps/api/src/index")

Bun.serve(serverModule.default)
