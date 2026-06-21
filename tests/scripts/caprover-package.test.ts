import { execFile } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "lms-caprover-package-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("CapRover package verifier", () => {
  it("accepts the checked-in captain definition and Dockerfile", async () => {
    const { stdout } = await execFileAsync("bun", ["scripts/verify-caprover-package.ts"], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
    })

    expect(stdout.trim()).toBe("verified CapRover package: captain-definition -> Dockerfile")
  })

  it("rejects captain definitions that do not deploy the repo Dockerfile", async () => {
    const { captainPath, dockerfilePath } = copyDeployPackage("bad-path")
    writeFileSync(
      captainPath,
      `${JSON.stringify({ schemaVersion: 2, dockerfilePath: "Dockerfile" })}\n`,
    )

    await expect(
      execFileAsync("bun", ["scripts/verify-caprover-package.ts", captainPath, dockerfilePath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("captain-definition dockerfilePath must be ./Dockerfile"),
    })
  })

  it("rejects Dockerfiles that drift from the mounted SQLite runtime shape", async () => {
    const { captainPath, dockerfilePath } = copyDeployPackage("bad-data-path")
    replaceInFile(
      dockerfilePath,
      "ENV DATABASE_URL=file:/app/data/lab.sqlite",
      "ENV DATABASE_URL=file:/app/lab.sqlite",
    )

    await expect(
      execFileAsync("bun", ["scripts/verify-caprover-package.ts", captainPath, dockerfilePath], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Dockerfile must store SQLite under the mounted /app/data path",
      ),
    })
  })
})

function copyDeployPackage(prefix: string) {
  const packageDir = join(tempDir, prefix)
  mkdirSync(packageDir)
  copyFileSync("captain-definition", join(packageDir, "captain-definition"))
  copyFileSync("Dockerfile", join(packageDir, "Dockerfile"))

  return {
    captainPath: join(packageDir, "captain-definition"),
    dockerfilePath: join(packageDir, "Dockerfile"),
  }
}

function replaceInFile(path: string, search: string, replacement: string) {
  const contents = readFileSync(path, "utf8")
  writeFileSync(path, contents.replace(search, replacement))
}
