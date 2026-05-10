import { fileURLToPath } from "node:url"
import { defineConfig } from "drizzle-kit"

const defaultDatabaseUrl = `file:${fileURLToPath(new URL("../../apps/api/data/lab.sqlite", import.meta.url))}`

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
})
