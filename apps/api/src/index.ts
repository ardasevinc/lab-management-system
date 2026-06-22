import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "@lab/db"
import { serveStatic } from "hono/bun"
import { createApiApp } from "./app"
import {
  apiRuntimeConfigFromEnv,
  bootstrapAdminFromEnv,
  databaseUrlFromEnv,
  notificationWorkerConfigFromEnv,
} from "./env"
import { createMailerFromEnv } from "./mailer"
import { startNotificationWorker } from "./notifications"

const defaultDatabaseUrl = `file:${fileURLToPath(new URL("../data/lab.sqlite", import.meta.url))}`
const runtimeConfig = apiRuntimeConfigFromEnv(Bun.env)
const bootstrapAdmin = bootstrapAdminFromEnv(Bun.env)
const databaseUrl = databaseUrlFromEnv(Bun.env, defaultDatabaseUrl)
const client = createDatabaseClient(databaseUrl)
const db = createDbFromClient(client)

await migrate(client)
await seedInitialData(db, new Date(), {
  bootstrapAdmin,
  requireBootstrapAdmin: runtimeConfig.appEnv === "production",
  seedLocalUsers: runtimeConfig.appEnv !== "production",
})

const port = Number(Bun.env.PORT ?? 3001)
const serveWeb = Bun.env.SERVE_WEB === "1"
const webDistDir = Bun.env.WEB_DIST_DIR ?? fileURLToPath(new URL("../../web/dist", import.meta.url))
const mailer = createMailerFromEnv(Bun.env)
const notificationWorkerConfig = notificationWorkerConfigFromEnv(Bun.env)
const app = createApiApp({
  db,
  config: runtimeConfig,
  notificationWorker: notificationWorkerConfig,
  mailer,
  assetMiddleware: serveWeb
    ? serveStatic({
        root: webDistDir,
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, immutable, max-age=31536000")
        },
      })
    : undefined,
  webMiddleware: serveWeb
    ? async (c) => {
        const indexFile = Bun.file(join(webDistDir, "index.html"))

        if (!(await indexFile.exists())) {
          return c.text("Web app is not built", 500)
        }

        c.header("Cache-Control", "no-store")
        c.header("Content-Type", "text/html; charset=utf-8")
        return c.body(await indexFile.text())
      }
    : undefined,
})

if (notificationWorkerConfig.enabled) {
  startNotificationWorker(db, mailer, {
    intervalSeconds: notificationWorkerConfig.intervalSeconds,
    startReminderMinutes: notificationWorkerConfig.startReminderMinutes,
    endingReminderMinutes: notificationWorkerConfig.endingReminderMinutes,
    retryDelayMinutes: notificationWorkerConfig.retryDelayMinutes,
    maxAttempts: notificationWorkerConfig.maxAttempts,
    publicAppUrl: runtimeConfig.publicAppUrl,
  })
}

export default {
  port,
  fetch: app.fetch,
}
