import { execFile } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "lms-install-backup-cron-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("backup cron installer", () => {
  it("prints a dry-run crontab with a managed backup block", async () => {
    const currentFile = writeTempFile("current.cron", "SHELL=/bin/sh\n")

    const { stdout } = await execFileAsync(
      "bun",
      ["scripts/install-backup-cron.ts", "--dry-run", "--current-file", currentFile],
      { encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } },
    )

    expect(stdout).toContain("SHELL=/bin/sh")
    expect(stdout).toContain("# BEGIN miralab-lms backup:miralab-lms")
    expect(stdout).toContain("bun run verify:sqlite-backup")
    expect(stdout).toContain("# END miralab-lms backup:miralab-lms")
    expect(stdout).toContain("dry run: backup cron block for miralab-lms was not installed")
  })

  it("writes the managed block to an output file", async () => {
    const currentFile = writeTempFile("empty.cron", "")
    const outputFile = join(tempDir, "installed.cron")

    const { stdout } = await execFileAsync(
      "bun",
      [
        "scripts/install-backup-cron.ts",
        "--current-file",
        currentFile,
        "--output-file",
        outputFile,
      ],
      { encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } },
    )

    expect(stdout.trim()).toBe("installed backup cron block for miralab-lms")
    expect(readFileSync(outputFile, "utf8")).toContain("# BEGIN miralab-lms backup:miralab-lms")
  })

  it("replaces an existing managed block instead of appending duplicates", async () => {
    const currentFile = writeTempFile(
      "existing.cron",
      [
        "MAILTO=admin@miralab.tr",
        "# BEGIN miralab-lms backup:miralab-lms",
        "* * * * * old-backup",
        "# END miralab-lms backup:miralab-lms",
        "",
      ].join("\n"),
    )
    const outputFile = join(tempDir, "replaced.cron")

    await execFileAsync(
      "bun",
      [
        "scripts/install-backup-cron.ts",
        "--current-file",
        currentFile,
        "--output-file",
        outputFile,
      ],
      { encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } },
    )

    const installed = readFileSync(outputFile, "utf8")
    expect(installed).toContain("MAILTO=admin@miralab.tr")
    expect(installed).not.toContain("old-backup")
    expect(installed.match(/# BEGIN miralab-lms backup:miralab-lms/g)).toHaveLength(1)
  })

  it("rejects duplicate unmanaged backup cron entries", async () => {
    const unmanagedEntry = await generatedCronEntry()
    const currentFile = writeTempFile("duplicate.cron", `${unmanagedEntry}\n`)
    const outputFile = join(tempDir, "duplicate-output.cron")

    await expect(
      execFileAsync(
        "bun",
        [
          "scripts/install-backup-cron.ts",
          "--current-file",
          currentFile,
          "--output-file",
          outputFile,
        ],
        { encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Refusing to install duplicate unmanaged backup cron entry for miralab-lms",
      ),
    })
  })
})

function writeTempFile(filename: string, contents: string) {
  const path = join(tempDir, filename)
  writeFileSync(path, contents)
  return path
}

async function generatedCronEntry() {
  const { stdout } = await execFileAsync("sh", ["scripts/backup-cron-entry.sh"], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  })

  return stdout.trim()
}
