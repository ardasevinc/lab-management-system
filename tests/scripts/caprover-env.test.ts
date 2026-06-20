import { execFileSync } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "lms-caprover-env-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("CapRover env verifier", () => {
  it("accepts the checked-in production env template", () => {
    const output = execFileSync("bun", ["scripts/verify-caprover-env.ts"], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
    }).trim()

    expect(output).toBe("verified CapRover env template: deploy/caprover.env.example")
  })

  it("rejects production footguns in env templates", () => {
    const envPath = copyTemplate("bad-caprover.env")
    replaceInFile(envPath, "SESSION_COOKIE_SECURE=1", "SESSION_COOKIE_SECURE=0")

    expect(() =>
      execFileSync("bun", ["scripts/verify-caprover-env.ts", envPath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
        stdio: "pipe",
      }),
    ).toThrow("SESSION_COOKIE_SECURE=1 is required in production")
  })

  it("keeps backup verification pointed at the deployed SQLite database", () => {
    const envPath = copyTemplate("bad-backup.env")
    replaceInFile(
      envPath,
      "BACKUP_DATABASE_PATH=/app/data/lab.sqlite",
      "BACKUP_DATABASE_PATH=/tmp/lab.sqlite",
    )

    expect(() =>
      execFileSync("bun", ["scripts/verify-caprover-env.ts", envPath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
        stdio: "pipe",
      }),
    ).toThrow("BACKUP_DATABASE_PATH must match DATABASE_URL")
  })
})

function copyTemplate(filename: string) {
  const destination = join(tempDir, filename)
  copyFileSync("deploy/caprover.env.example", destination)
  return destination
}

function replaceInFile(path: string, search: string, replacement: string) {
  const contents = readFileSync(path, "utf8")
  writeFileSync(path, contents.replace(search, replacement))
}
