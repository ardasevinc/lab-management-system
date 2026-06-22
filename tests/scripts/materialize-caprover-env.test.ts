import { execFileSync } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "lms-materialize-caprover-env-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("CapRover env materializer", () => {
  it("writes a verified local env file without printing secrets", () => {
    const outputPath = join(tempDir, "caprover.env")
    const fakePa = writeFakePa()

    const output = execFileSync(
      "bun",
      [
        "scripts/materialize-caprover-env.ts",
        "--out",
        outputPath,
        "--pa-bin",
        fakePa,
        "--access-key-item",
        "test/access-key",
        "--secret-key-item",
        "test/secret-key",
        "--bootstrap-admin-email",
        "arda@example.com",
        "--bootstrap-admin-name",
        "Arda Sevinc",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
      },
    )

    const contents = readFileSync(outputPath, "utf8")
    expect(output).toBe(`wrote CapRover env with materialized deployment secrets: ${outputPath}\n`)
    expect(output).not.toContain("AKIATEST")
    expect(output).not.toContain("test-secret")
    expect(output).not.toContain("arda@example.com")
    expect(contents).toContain("AWS_ACCESS_KEY_ID=AKIATEST")
    expect(contents).toContain("AWS_SECRET_ACCESS_KEY=test-secret")
    expect(contents).toContain("BOOTSTRAP_ADMIN_EMAIL=arda@example.com")
    expect(contents).toContain("BOOTSTRAP_ADMIN_NAME=Arda Sevinc")
    expect(contents).toContain("ALLOWED_EMAIL_DOMAINS=")
    expect(statSync(outputPath).mode & 0o777).toBe(0o600)
  })

  it("fails when the selected pa item returns an empty secret", () => {
    const outputPath = join(tempDir, "caprover.env")
    const fakePa = writeFakePa({ emptySecret: true })

    expect(() =>
      execFileSync(
        "bun",
        [
          "scripts/materialize-caprover-env.ts",
          "--out",
          outputPath,
          "--pa-bin",
          fakePa,
          "--access-key-item",
          "test/access-key",
          "--secret-key-item",
          "test/secret-key",
          "--bootstrap-admin-email",
          "arda@example.com",
          "--bootstrap-admin-name",
          "Arda Sevinc",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, NODE_ENV: "test" },
          stdio: "pipe",
        },
      ),
    ).toThrow("pa item test/secret-key returned an empty AWS secret access key")
  })

  it("fails when bootstrap admin identity is missing", () => {
    const outputPath = join(tempDir, "caprover.env")
    const fakePa = writeFakePa()

    expect(() =>
      execFileSync(
        "bun",
        [
          "scripts/materialize-caprover-env.ts",
          "--out",
          outputPath,
          "--pa-bin",
          fakePa,
          "--access-key-item",
          "test/access-key",
          "--secret-key-item",
          "test/secret-key",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_ENV: "test",
            BOOTSTRAP_ADMIN_EMAIL: "",
            BOOTSTRAP_ADMIN_NAME: "",
          },
          stdio: "pipe",
        },
      ),
    ).toThrow("BOOTSTRAP_ADMIN_EMAIL must be set or passed with --bootstrap-admin-email")
  })
})

function writeFakePa(options: { emptySecret?: boolean } = {}) {
  const path = join(tempDir, "fake-pa.sh")
  writeFileSync(
    path,
    `#!/usr/bin/env sh
set -eu
if [ "$1" != "show" ]; then
  exit 2
fi
case "$2" in
  test/access-key)
    printf '%s\\n' 'AKIATEST'
    ;;
  test/secret-key)
    ${options.emptySecret ? "printf ''" : "printf '%s\\n' 'test-secret'"}
    ;;
  *)
    exit 3
    ;;
esac
`,
  )
  chmodSync(path, 0o700)
  return path
}
