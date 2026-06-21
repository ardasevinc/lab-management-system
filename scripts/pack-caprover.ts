import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

type PackOptions = {
  allowDirty: boolean
  outputPath?: string
}

type ArchiveManifestCheck = {
  missing: string[]
  presentForbidden: string[]
}

const REQUIRED_ARCHIVE_ENTRIES = [
  "captain-definition",
  "Dockerfile",
  "package.json",
  "bun.lock",
  "apps/api/package.json",
  "apps/api/src/index.ts",
  "apps/web/package.json",
  "apps/web/.env.production",
  "packages/config/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
]

const FORBIDDEN_ARCHIVE_ENTRIES = [
  ".env",
  "apps/api/.env",
  "apps/web/.env",
  ".tmp/caprover.env",
  "data/lab.sqlite",
  "apps/api/data/lab.sqlite",
  "node_modules/",
  "apps/api/node_modules/",
  "apps/web/node_modules/",
]

if (import.meta.main) {
  await main(Bun.argv.slice(2))
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const shortSha = gitOutput(["rev-parse", "--short", "HEAD"]).trim()

  if (!options.allowDirty) {
    assertCleanTrackedTree()
  }

  const outputPath = options.outputPath ?? defaultOutputPath(shortSha)
  mkdirSync(dirname(outputPath), { recursive: true })

  run("git", ["archive", "--format=tar.gz", `--output=${outputPath}`, "HEAD"])

  const entries = listArchiveEntries(outputPath)
  const manifest = checkArchiveManifest(entries)
  if (manifest.missing.length > 0 || manifest.presentForbidden.length > 0) {
    throw new Error(formatManifestError(manifest))
  }

  console.log(`packed CapRover archive: ${outputPath}`)
}

export function parseArgs(args: string[]): PackOptions {
  const options: PackOptions = { allowDirty: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--allow-dirty":
        options.allowDirty = true
        break
      case "--out":
        options.outputPath = requireValue(arg, value)
        index += 1
        break
      case "--help":
        printUsage()
        process.exit(0)
        return options
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export function defaultOutputPath(shortSha: string) {
  return join(".tmp", "caprover", `miralab-lms-${shortSha}.tar.gz`)
}

export function normalizeArchiveEntry(entry: string) {
  return entry.replace(/^\.\//, "")
}

export function checkArchiveManifest(entries: string[]): ArchiveManifestCheck {
  const normalized = entries.map(normalizeArchiveEntry)
  const entrySet = new Set(normalized)
  const missing = REQUIRED_ARCHIVE_ENTRIES.filter((entry) => !entrySet.has(entry))
  const presentForbidden = FORBIDDEN_ARCHIVE_ENTRIES.filter((entry) =>
    entry.endsWith("/")
      ? normalized.some((candidate) => candidate.startsWith(entry))
      : entrySet.has(entry),
  )

  return { missing, presentForbidden }
}

export function formatManifestError(check: ArchiveManifestCheck) {
  const lines = ["CapRover archive manifest check failed"]

  if (check.missing.length > 0) {
    lines.push(`missing: ${check.missing.join(", ")}`)
  }

  if (check.presentForbidden.length > 0) {
    lines.push(`forbidden: ${check.presentForbidden.join(", ")}`)
  }

  return lines.join("\n")
}

function assertCleanTrackedTree() {
  const dirty = gitOutput(["status", "--porcelain", "--untracked-files=no"]).trim()
  if (dirty) {
    throw new Error("Tracked working tree is dirty; commit or pass --allow-dirty before packaging")
  }
}

function listArchiveEntries(path: string) {
  return commandOutput("tar", ["-tzf", path])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function gitOutput(args: string[]) {
  return commandOutput("git", args)
}

function commandOutput(command: string, args: string[]) {
  const result = Bun.spawnSync({
    cmd: [command, ...args],
    stderr: "pipe",
    stdout: "pipe",
  })

  if (!result.success) {
    throw new Error(result.stderr.toString().trim() || `${command} ${args.join(" ")} failed`)
  }

  return result.stdout.toString()
}

function run(command: string, args: string[]) {
  commandOutput(command, args)
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function printUsage() {
  console.log(`Usage: bun scripts/pack-caprover.ts [--out .tmp/caprover/miralab-lms.tar.gz] [--allow-dirty]

Creates a deterministic CapRover upload archive from git HEAD and verifies the
archive includes the deployment manifest/Docker context while excluding local
env, SQLite, node_modules, and temporary artifacts.`)
}
