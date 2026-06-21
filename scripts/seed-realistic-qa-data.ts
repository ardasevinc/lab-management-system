import { fileURLToPath } from "node:url"
import {
  createDatabaseClient,
  createDbFromClient,
  migrate,
  seedRealisticQaData,
} from "../packages/db/src"

const defaultDatabaseUrl = `file:${fileURLToPath(new URL("../apps/api/data/lab.sqlite", import.meta.url))}`
const databaseUrl = Bun.argv[2] ?? Bun.env.DATABASE_URL ?? defaultDatabaseUrl
const appEnv = Bun.env.APP_ENV ?? Bun.env.NODE_ENV ?? "development"

if (appEnv === "production") {
  throw new Error("Refusing to seed realistic QA data with APP_ENV/NODE_ENV=production")
}

if (!databaseUrl.startsWith("file:") && databaseUrl !== "file::memory:") {
  throw new Error("Realistic QA data seeding is only supported for local SQLite file databases")
}

const client = createDatabaseClient(databaseUrl)
await migrate(client)
const db = createDbFromClient(client)
const result = await seedRealisticQaData(db)

client.close()

console.log(
  `seeded realistic QA data in ${databaseUrl}: ${result.users} users, ${result.machines} machines, ${result.bookings} bookings`,
)
