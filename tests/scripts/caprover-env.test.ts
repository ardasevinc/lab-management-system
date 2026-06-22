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

  it("accepts a materialized env file when real secret mode is explicit", () => {
    const envPath = copyTemplate("real-secrets.env")
    replaceInFile(envPath, "AWS_ACCESS_KEY_ID=<set-in-caprover>", "AWS_ACCESS_KEY_ID=AKIATEST")
    replaceInFile(
      envPath,
      "AWS_SECRET_ACCESS_KEY=<set-in-caprover>",
      "AWS_SECRET_ACCESS_KEY=test-secret",
    )
    replaceInFile(
      envPath,
      "BOOTSTRAP_ADMIN_EMAIL=<set-in-caprover>",
      "BOOTSTRAP_ADMIN_EMAIL=arda@example.com",
    )
    replaceInFile(
      envPath,
      "BOOTSTRAP_ADMIN_NAME=<set-in-caprover>",
      "BOOTSTRAP_ADMIN_NAME=Arda Sevinc",
    )

    const output = execFileSync(
      "bun",
      ["scripts/verify-caprover-env.ts", envPath, "--real-secrets"],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
      },
    ).trim()

    expect(output).toBe(`verified CapRover env template: ${envPath}`)
  })

  it("rejects placeholder secrets in real secret mode", () => {
    const envPath = copyTemplate("placeholder-secrets.env")

    expect(() =>
      execFileSync("bun", ["scripts/verify-caprover-env.ts", envPath, "--real-secrets"], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
        stdio: "pipe",
      }),
    ).toThrow("BOOTSTRAP_ADMIN_EMAIL must be materialized for real-secret env verification")
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
    ).toThrow("BACKUP_DATABASE_PATH must be /app/data/lab.sqlite")
  })

  it("pins the web dist path to the Docker runtime layout", () => {
    const envPath = copyTemplate("bad-web-dist.env")
    replaceInFile(envPath, "WEB_DIST_DIR=/app/apps/web/dist", "WEB_DIST_DIR=/app/web/dist")

    expect(() =>
      execFileSync("bun", ["scripts/verify-caprover-env.ts", envPath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
        stdio: "pipe",
      }),
    ).toThrow("WEB_DIST_DIR must be /app/apps/web/dist")
  })

  it("pins reminder worker timing to the production smoke baseline", () => {
    const envPath = copyTemplate("bad-reminder.env")
    replaceInFile(
      envPath,
      "NOTIFICATION_WORKER_INTERVAL_SECONDS=60",
      "NOTIFICATION_WORKER_INTERVAL_SECONDS=600",
    )

    expect(() =>
      execFileSync("bun", ["scripts/verify-caprover-env.ts", envPath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
        stdio: "pipe",
      }),
    ).toThrow("NOTIFICATION_WORKER_INTERVAL_SECONDS must be 60")
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
