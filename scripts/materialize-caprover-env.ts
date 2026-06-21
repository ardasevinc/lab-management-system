import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

const DEFAULT_TEMPLATE_PATH = "deploy/caprover.env.example"
const DEFAULT_OUTPUT_PATH = ".tmp/caprover.env"
const DEFAULT_PA_BIN = "pa"
const DEFAULT_ACCESS_KEY_ITEM = "aws/miralab-lms-ses-sender/access-key-id"
const DEFAULT_SECRET_KEY_ITEM = "aws/miralab-lms-ses-sender/secret-access-key"

const options = parseArgs(Bun.argv.slice(2))
const templatePath = options.templatePath ?? DEFAULT_TEMPLATE_PATH
const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH
const paBin = options.paBin ?? DEFAULT_PA_BIN
const accessKeyItem = options.accessKeyItem ?? DEFAULT_ACCESS_KEY_ITEM
const secretKeyItem = options.secretKeyItem ?? DEFAULT_SECRET_KEY_ITEM

const accessKey = readPaSecret(paBin, accessKeyItem, "AWS access key id")
const secretKey = readPaSecret(paBin, secretKeyItem, "AWS secret access key")
const template = await Bun.file(templatePath).text()
const materialized = replaceEnvValues(template, {
  AWS_ACCESS_KEY_ID: accessKey,
  AWS_SECRET_ACCESS_KEY: secretKey,
})

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, materialized, { encoding: "utf8", mode: 0o600 })
chmodSync(outputPath, 0o600)

await verifyMaterializedEnv(outputPath)

console.log(`wrote CapRover env with materialized SES secrets: ${outputPath}`)

function parseArgs(args: string[]) {
  const parsed: {
    accessKeyItem?: string
    outputPath?: string
    paBin?: string
    secretKeyItem?: string
    templatePath?: string
  } = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--template":
        parsed.templatePath = requireValue(arg, value)
        index += 1
        break
      case "--out":
        parsed.outputPath = requireValue(arg, value)
        index += 1
        break
      case "--pa-bin":
        parsed.paBin = requireValue(arg, value)
        index += 1
        break
      case "--access-key-item":
        parsed.accessKeyItem = requireValue(arg, value)
        index += 1
        break
      case "--secret-key-item":
        parsed.secretKeyItem = requireValue(arg, value)
        index += 1
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }

  return parsed
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function readPaSecret(paBin: string, item: string, label: string) {
  const result = Bun.spawnSync({
    cmd: [paBin, "show", item],
    stdout: "pipe",
    stderr: "pipe",
  })

  if (!result.success) {
    throw new Error(`Could not read ${label} from pa item ${item}`)
  }

  const value = result.stdout.toString().trim()
  if (!value) {
    throw new Error(`pa item ${item} returned an empty ${label}`)
  }

  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`pa item ${item} returned a multi-line ${label}`)
  }

  return value
}

function replaceEnvValues(template: string, replacements: Record<string, string>) {
  const seen = new Set<string>()
  const lines = template.split(/\r?\n/).map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line)
    if (!match) {
      return line
    }

    const key = match[1]
    const replacement = replacements[key]
    if (!replacement) {
      return line
    }

    seen.add(key)
    return `${key}=${replacement}`
  })

  for (const key of Object.keys(replacements)) {
    if (!seen.has(key)) {
      throw new Error(`Template is missing ${key}`)
    }
  }

  return lines.join("\n")
}

async function verifyMaterializedEnv(path: string) {
  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/verify-caprover-env.ts", path, "--real-secrets"],
    stdout: "pipe",
    stderr: "pipe",
  })

  if (!result.success) {
    throw new Error(`Materialized CapRover env failed verification: ${result.stderr.toString()}`)
  }
}
