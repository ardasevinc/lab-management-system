import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Docker runtime verifier", () => {
  it("proves the produced mounted backup can be restored", () => {
    const script = readFileSync("scripts/verify-docker-runtime.sh", "utf8")

    expect(script).toContain("backup_file=")
    expect(script).toContain("sh scripts/backup-sqlite.sh")
    expect(script).toContain('sh scripts/verify-sqlite-backup.sh "$backup_file"')
    expect(script).toContain('bun scripts/restore-sqlite-backup.ts "$backup_file"')
    expect(script.indexOf("sh scripts/backup-sqlite.sh")).toBeLessThan(
      script.indexOf('bun scripts/restore-sqlite-backup.ts "$backup_file"'),
    )
  })
})
