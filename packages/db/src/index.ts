import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { type Client, createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

export function createDatabaseClient(url: string) {
  if (url.startsWith("file:") && !url.startsWith("file::memory:")) {
    mkdirSync(dirname(url.replace(/^file:/, "")), { recursive: true })
  }

  return createClient({ url })
}

export function createDbFromClient(client: Client) {
  return drizzle(client, { schema })
}

export function createDb(url: string) {
  return createDbFromClient(createDatabaseClient(url))
}

export type Db = ReturnType<typeof createDb>
export * from "./migrate"
export * from "./repository"
