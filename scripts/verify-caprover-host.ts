type CapRoverHostOptions = {
  appName: string
  expectation: "absent" | "at-most-one" | "running"
  host: string
}

type ContainerRow = {
  name: string
  status: string
}

const DEFAULT_OPTIONS: CapRoverHostOptions = {
  appName: "miralab-lms",
  expectation: "at-most-one",
  host: "meruem",
}

if (import.meta.main) {
  await main(Bun.argv.slice(2))
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const engineRows = parseDockerRows(await ssh(options.host, engineContainersCommand()))
  const appRows = parseDockerRows(await ssh(options.host, appContainersCommand(options.appName)))

  const engineResult = evaluateEngineContainers(engineRows)
  if (!engineResult.ok) {
    fail(engineResult.message)
  }

  const appResult = evaluateAppContainers(appRows, options)
  if (!appResult.ok) {
    fail(appResult.message)
  }

  const appSummary =
    appRows.length === 0
      ? "no app container"
      : `${appRows[0]?.name ?? "unknown"} (${appRows[0]?.status ?? "unknown status"})`
  console.log(
    `verified CapRover host ${options.host}: engine ok, ${options.appName} ${options.expectation}, ${appSummary}`,
  )
}

export function parseArgs(args: string[]): CapRoverHostOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--app":
        options.appName = requireValue(arg, value)
        index += 1
        break
      case "--expect":
        options.expectation = parseExpectation(requireValue(arg, value))
        index += 1
        break
      case "--host":
        options.host = requireValue(arg, value)
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

  assertSafeIdentifier("app", options.appName)
  assertSafeIdentifier("host", options.host)
  return options
}

export function parseDockerRows(output: string): ContainerRow[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, status = ""] = line.split("\t")
      return { name, status }
    })
}

export function evaluateEngineContainers(rows: ContainerRow[]) {
  const captain = rows.find((row) => row.name.startsWith("captain-captain."))
  const nginx = rows.find((row) => row.name.startsWith("captain-nginx."))

  if (!captain?.status.startsWith("Up")) {
    return { ok: false, message: "CapRover captain container is not running" }
  }

  if (!nginx?.status.startsWith("Up")) {
    return { ok: false, message: "CapRover nginx container is not running" }
  }

  return { ok: true, message: "CapRover engine containers are running" }
}

export function evaluateAppContainers(rows: ContainerRow[], options: CapRoverHostOptions) {
  if (rows.length > 1) {
    return {
      ok: false,
      message: `${options.appName} has ${rows.length} running containers; SQLite MVP requires exactly one`,
    }
  }

  if (options.expectation === "absent" && rows.length !== 0) {
    return { ok: false, message: `${options.appName} already has a running app container` }
  }

  if (options.expectation === "running") {
    const container = rows[0]
    if (!container?.status.startsWith("Up")) {
      return {
        ok: false,
        message: `${options.appName} does not have one healthy running container`,
      }
    }
  }

  return {
    ok: true,
    message: `${options.appName} container cardinality matches ${options.expectation}`,
  }
}

export function appContainersCommand(appName: string) {
  return `docker ps --filter 'name=^/srv-captain--${appName}\\.' --format '{{.Names}}\\t{{.Status}}'`
}

export function engineContainersCommand() {
  return "docker ps --filter 'name=^/captain-(captain|nginx)\\.' --format '{{.Names}}\\t{{.Status}}'"
}

function parseExpectation(value: string): CapRoverHostOptions["expectation"] {
  if (value === "absent" || value === "at-most-one" || value === "running") {
    return value
  }

  throw new Error("--expect must be one of: absent, at-most-one, running")
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function assertSafeIdentifier(label: string, value: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`${label} contains unsafe characters`)
  }
}

async function ssh(host: string, command: string) {
  const result = Bun.spawnSync({
    cmd: ["ssh", host, command],
    stderr: "pipe",
    stdout: "pipe",
  })

  if (!result.success) {
    throw new Error(result.stderr.toString().trim() || `ssh ${host} command failed`)
  }

  return result.stdout.toString()
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage: bun scripts/verify-caprover-host.ts [--host meruem] [--app miralab-lms] [--expect at-most-one|absent|running]

Checks CapRover engine containers and the MIRALAB LMS app container cardinality over SSH.
Use --expect absent before first app creation, --expect running after deployment, and
the default --expect at-most-one as a safe SQLite MVP guard.`)
}
