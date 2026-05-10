import { fileURLToPath } from "node:url"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "@lab/db"
import { serveStatic } from "hono/bun"
import { createApiApp } from "./app"

const defaultDatabaseUrl = `file:${fileURLToPath(new URL("../data/lab.sqlite", import.meta.url))}`
const databaseUrl = Bun.env.DATABASE_URL ?? defaultDatabaseUrl
const client = createDatabaseClient(databaseUrl)
const db = createDbFromClient(client)

await migrate(client)
await seedInitialData(db)

const port = Number(Bun.env.PORT ?? 3001)
const serveWeb = Bun.env.SERVE_WEB === "1"
const webDistDir = Bun.env.WEB_DIST_DIR ?? fileURLToPath(new URL("../../web/dist", import.meta.url))
const app = createApiApp({
  db,
  assetMiddleware: serveWeb
    ? serveStatic({
        root: webDistDir,
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, immutable, max-age=31536000")
        },
      })
    : undefined,
  webMiddleware: serveWeb ? serveStatic({ root: webDistDir, path: "index.html" }) : undefined,
})

export default {
  port,
  fetch: app.fetch,
}
