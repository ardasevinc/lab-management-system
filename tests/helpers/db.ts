import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "@lab/db"

export async function createTestDb() {
  const tempDir = mkdtempSync(join(tmpdir(), "lab-management-test-"))
  const url = `file:${join(tempDir, "test.sqlite")}`
  const client = createDatabaseClient(url)
  await migrate(client)
  const db = createDbFromClient(client)
  await seedInitialData(db, new Date("2026-05-10T09:00:00.000Z"))

  return {
    db,
    client,
    url,
    close: () => {
      client.close()
      rmSync(tempDir, { recursive: true, force: true })
    },
  }
}
