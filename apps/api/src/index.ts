import { labConfig } from "@lab/config"
import { machines } from "@lab/domain"
import { Hono } from "hono"
import { serveStatic } from "hono/bun"
import { cors } from "hono/cors"

const app = new Hono()
const serveWeb = Bun.env.SERVE_WEB === "1"
const webDistDir = Bun.env.WEB_DIST_DIR ?? "apps/web/dist"

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
)

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "lab-api",
    lab: labConfig.shortName,
  }),
)

app.get("/config/public", (c) => c.json(labConfig))

app.get("/machines", (c) => c.json({ machines }))

if (serveWeb) {
  app.get(
    "/assets/*",
    serveStatic({
      root: webDistDir,
      onFound: (_path, c) => {
        c.header("Cache-Control", "public, immutable, max-age=31536000")
      },
    }),
  )

  app.get("*", serveStatic({ path: `${webDistDir}/index.html` }))
}

const port = Number(Bun.env.PORT ?? 3001)

export default {
  port,
  fetch: app.fetch,
}
