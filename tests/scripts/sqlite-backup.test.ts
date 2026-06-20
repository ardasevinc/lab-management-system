import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "@lab/db"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "lms-sqlite-backup-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("SQLite backup scripts", () => {
  it("creates and verifies a SQLite backup from DATABASE_URL=file:", () => {
    const databasePath = join(tempDir, "lab.sqlite")
    const backupDir = join(tempDir, "backups")
    seedReadableDatabase(databasePath)

    const backupFile = execFileSync("sh", ["scripts/backup-sqlite.sh"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
        BACKUP_DIR: backupDir,
      },
    }).trim()

    const verifyOutput = execFileSync("sh", ["scripts/verify-sqlite-backup.sh", backupFile], {
      encoding: "utf8",
    }).trim()

    expect(backupFile.startsWith(`${backupDir}/lab-`)).toBe(true)
    expect(backupFile.endsWith(".sqlite")).toBe(true)
    expect(existsSync(backupFile)).toBe(true)
    expect(verifyOutput).toBe(`verified ${backupFile}`)
  })

  it("fails clearly when DATABASE_URL is not file-backed", () => {
    expect(() =>
      execFileSync("sh", ["scripts/backup-sqlite.sh"], {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: "libsql://example.turso.io",
          BACKUP_DIR: join(tempDir, "backups"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ).toThrow(/DATABASE_URL must use file: for SQLite backups/)
  })

  it("runs a restore drill against a migrated app backup", async () => {
    const databasePath = join(tempDir, "app.sqlite")
    const backupDir = join(tempDir, "backups")
    const client = createDatabaseClient(`file:${databasePath}`)
    const db = createDbFromClient(client)

    try {
      await migrate(client)
      await seedInitialData(db, new Date("2026-05-10T09:00:00.000Z"))
    } finally {
      client.close()
    }

    const backupFile = execFileSync("sh", ["scripts/backup-sqlite.sh"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
        BACKUP_DIR: backupDir,
      },
    }).trim()

    const restoreOutput = execFileSync("bun", ["scripts/restore-sqlite-backup.ts", backupFile], {
      encoding: "utf8",
    }).trim()

    expect(restoreOutput).toBe(`restore drill passed for ${backupFile}`)
  })
})

function seedReadableDatabase(databasePath: string) {
  execFileSync(
    "sqlite3",
    [
      databasePath,
      [
        "CREATE TABLE machines (id TEXT PRIMARY KEY);",
        "CREATE TABLE users (id TEXT PRIMARY KEY);",
        "INSERT INTO machines (id) VALUES ('tohum');",
        "INSERT INTO users (id) VALUES ('admin-local');",
      ].join(" "),
    ],
    { encoding: "utf8" },
  )
}
