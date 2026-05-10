import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "."

const databaseUrl = Bun.env.DATABASE_URL ?? "file:data/lab.sqlite"
const client = createDatabaseClient(databaseUrl)
const db = createDbFromClient(client)

await migrate(client)
await seedInitialData(db)
client.close()

console.log(`seeded ${databaseUrl}`)
