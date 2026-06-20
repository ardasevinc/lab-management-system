import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { createDatabaseClient, migrate } from "../packages/db/src/index"

const backupFile = Bun.argv[2]

if (!backupFile) {
  console.error("Usage: bun scripts/restore-sqlite-backup.ts <backup-file>")
  process.exit(1)
}

if (!existsSync(backupFile)) {
  console.error(`backup file not found: ${backupFile}`)
  process.exit(1)
}

const restoreDir = mkdtempSync(join(tmpdir(), "lms-sqlite-restore-"))
const restorePath = join(restoreDir, basename(backupFile))

try {
  copyFileSync(backupFile, restorePath)

  const client = createDatabaseClient(`file:${restorePath}`)
  try {
    await migrate(client)
    await assertIntegrity(client)
    await assertReadableCoreTables(client)
  } finally {
    client.close()
  }

  console.log(`restore drill passed for ${backupFile}`)
} finally {
  rmSync(restoreDir, { recursive: true, force: true })
}

async function assertIntegrity(client: ReturnType<typeof createDatabaseClient>) {
  const result = await client.execute("PRAGMA integrity_check;")
  const row = result.rows[0]
  const value = row ? Object.values(row)[0] : null

  if (value !== "ok") {
    throw new Error(`restore integrity check failed: ${String(value)}`)
  }
}

async function assertReadableCoreTables(client: ReturnType<typeof createDatabaseClient>) {
  for (const table of ["machines", "users"]) {
    const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table};`)
    const count = Number(result.rows[0]?.count ?? 0)

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`restore verification failed: ${table} table is empty or unreadable`)
    }
  }
}
