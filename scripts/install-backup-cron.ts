import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const options = parseArgs(Bun.argv.slice(2))
const appName = Bun.env.BACKUP_CAPROVER_APP ?? "miralab-lms"
const markerName = `miralab-lms backup:${appName}`
const beginMarker = `# BEGIN ${markerName}`
const endMarker = `# END ${markerName}`
const entry = generateCronEntry()
const block = `${beginMarker}\n${entry}\n${endMarker}`
const currentCrontab = readCurrentCrontab()
const nextCrontab = upsertManagedBlock(currentCrontab, block)

if (options.dryRun) {
  console.log(nextCrontab.trimEnd())
  console.log(`dry run: backup cron block for ${appName} was not installed`)
} else {
  writeCrontab(nextCrontab)
  console.log(`installed backup cron block for ${appName}`)
}

type Options = {
  dryRun: boolean
  currentFile?: string
  outputFile?: string
}

function parseArgs(args: string[]): Options {
  const parsed: Options = { dryRun: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--dry-run") {
      parsed.dryRun = true
      continue
    }

    if (arg === "--current-file") {
      index += 1
      parsed.currentFile = requiredValue(args, index, arg)
      continue
    }

    if (arg === "--output-file") {
      index += 1
      parsed.outputFile = requiredValue(args, index, arg)
      continue
    }

    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  if (parsed.outputFile && parsed.dryRun) {
    throw new Error("--output-file cannot be combined with --dry-run")
  }

  return parsed
}

function requiredValue(args: string[], index: number, option: string) {
  const value = args[index]
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function printHelp() {
  console.log(`Usage: bun scripts/install-backup-cron.ts [--dry-run]

Install or replace the marked MIRALAB LMS backup cron block in the current host crontab.
Run this on the CapRover host after the app exists and exactly one app container matches.

Environment is passed through to scripts/backup-cron-entry.sh:
  BACKUP_CAPROVER_APP, BACKUP_CRON_SCHEDULE, BACKUP_DATABASE_URL,
  BACKUP_DIR, BACKUP_RETENTION_DAYS, BACKUP_LOCK_PATH, BACKUP_CRON_LOG

Test-only options:
  --current-file <path>  Read crontab contents from a file instead of crontab -l.
  --output-file <path>   Write updated crontab contents to a file instead of crontab -.
`)
}

function generateCronEntry() {
  return execFileSync("sh", ["scripts/backup-cron-entry.sh"], {
    encoding: "utf8",
    env: process.env,
  }).trim()
}

function readCurrentCrontab() {
  if (options.currentFile) {
    return existsSync(options.currentFile) ? readFileSync(options.currentFile, "utf8") : ""
  }

  const result = spawnSync("crontab", ["-l"], { encoding: "utf8" })
  if (result.status === 0) {
    return result.stdout
  }

  const stderr = result.stderr.trim()
  if (stderr.includes("no crontab") || stderr.includes("no crontab for")) {
    return ""
  }

  throw new Error(stderr || "failed to read current crontab")
}

function upsertManagedBlock(current: string, managedBlock: string) {
  const normalizedCurrent = current.trimEnd()
  const blockRegex = new RegExp(`${escapeRegExp(beginMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`)

  if (blockRegex.test(normalizedCurrent)) {
    return `${normalizedCurrent.replace(blockRegex, managedBlock)}\n`
  }

  if (normalizedCurrent.includes(entry)) {
    throw new Error(
      `Refusing to install duplicate unmanaged backup cron entry for ${appName}; remove the old line or wrap it in the managed block.`,
    )
  }

  if (!normalizedCurrent) {
    return `${managedBlock}\n`
  }

  return `${normalizedCurrent}\n\n${managedBlock}\n`
}

function writeCrontab(contents: string) {
  if (options.outputFile) {
    writeFileSync(options.outputFile, contents)
    return
  }

  const result = spawnSync("crontab", ["-"], {
    encoding: "utf8",
    input: contents,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "failed to install crontab")
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
