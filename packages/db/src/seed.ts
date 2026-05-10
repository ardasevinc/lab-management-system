import { fileURLToPath } from "node:url"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "."

const defaultDatabaseUrl = `file:${fileURLToPath(new URL("../../../apps/api/data/lab.sqlite", import.meta.url))}`
const databaseUrl = Bun.env.DATABASE_URL ?? defaultDatabaseUrl
const client = createDatabaseClient(databaseUrl)
const db = createDbFromClient(client)

await migrate(client)
await seedInitialData(db)
client.close()

console.log(`seeded ${databaseUrl}`)
