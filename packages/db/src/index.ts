import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

export function createDb(path = "data/lab.sqlite") {
  const sqlite = new Database(path)
  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")

  return drizzle(sqlite, { schema })
}

export type Db = ReturnType<typeof createDb>
