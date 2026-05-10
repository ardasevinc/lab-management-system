import { fileURLToPath } from "node:url"
import type { Client } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate as runMigrations } from "drizzle-orm/libsql/migrator"
import * as schema from "./schema"

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))

export async function migrate(client: Client) {
  await runMigrations(drizzle(client, { schema }), { migrationsFolder })
}
