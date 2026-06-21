import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

describe("backup cron entry generator", () => {
  it("emits the default CapRover host cron line", () => {
    const output = execFileSync("sh", ["scripts/backup-cron-entry.sh"], {
      encoding: "utf8",
    }).trim()

    expect(output).toBe(
      "17 2 * * * containers=$(docker ps --filter 'name=^/srv-captain--miralab-lms\\.' --format '{{.Names}}') && test -n \"$containers\" && test \"$(printf '%s\\n' \"$containers\" | wc -l | tr -d ' ')\" = 1 && container=\"$containers\" && docker exec \"$container\" sh -lc 'cd /app && DATABASE_URL='\\''file:/app/data/lab.sqlite'\\'' BACKUP_DIR='\\''/app/data/backups'\\'' BACKUP_RETENTION_DAYS='\\''30'\\'' bun run verify:sqlite-backup' >> '/var/log/miralab-lms-backup.log' 2>&1",
    )
  })

  it("shell-quotes configured container, backup, retention, and log values", () => {
    const output = execFileSync("sh", ["scripts/backup-cron-entry.sh"], {
      encoding: "utf8",
      env: {
        ...process.env,
        BACKUP_CAPROVER_APP: "miralab-lms-prod",
        BACKUP_CRON_SCHEDULE: "9 4 * * 1-5",
        BACKUP_DATABASE_URL: "file:/app/data/lab prod.sqlite",
        BACKUP_DIR: "/app/data/backups daily",
        BACKUP_RETENTION_DAYS: "45",
        BACKUP_CRON_LOG: "/tmp/miralab backup's.log",
      },
    }).trim()

    expect(output).toBe(
      "9 4 * * 1-5 containers=$(docker ps --filter 'name=^/srv-captain--miralab-lms-prod\\.' --format '{{.Names}}') && test -n \"$containers\" && test \"$(printf '%s\\n' \"$containers\" | wc -l | tr -d ' ')\" = 1 && container=\"$containers\" && docker exec \"$container\" sh -lc 'cd /app && DATABASE_URL='\\''file:/app/data/lab prod.sqlite'\\'' BACKUP_DIR='\\''/app/data/backups daily'\\'' BACKUP_RETENTION_DAYS='\\''45'\\'' bun run verify:sqlite-backup' >> '/tmp/miralab backup'\\''s.log' 2>&1",
    )
  })
})
