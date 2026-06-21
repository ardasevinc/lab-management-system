type PostdeployOptions = {
  appName: string
  email: string
  host: string
  origin: string
}

const DEFAULT_APP_NAME = "miralab-lms"
const DEFAULT_HOST = "meruem"

if (import.meta.main) {
  try {
    await main(Bun.argv.slice(2))
  } catch (error) {
    console.error(errorMessage(error))
    process.exit(1)
  }
}

export async function main(args: string[]) {
  const options = parseArgs(args, process.env)

  for (const command of postdeployCommands(options)) {
    await run(command)
  }

  console.log(`verified postdeploy smoke: ${options.origin} as ${options.email}`)
}

export function parseArgs(args: string[], env: Record<string, string | undefined> = process.env) {
  const positional: string[] = []
  const options: Partial<PostdeployOptions> = {
    appName: DEFAULT_APP_NAME,
    host: DEFAULT_HOST,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--app":
        options.appName = requireValue(arg, value)
        index += 1
        break
      case "--host":
        options.host = requireValue(arg, value)
        index += 1
        break
      case "--help":
        printUsage()
        process.exit(0)
        break
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`)
        }
        positional.push(arg)
        break
    }
  }

  options.origin =
    positional[0] ??
    env.DEPLOY_POSTDEPLOY_URL ??
    env.DEPLOY_SMOKE_URL ??
    env.PUBLIC_APP_URL ??
    undefined
  options.email =
    positional[1] ??
    env.DEPLOY_POSTDEPLOY_EMAIL ??
    env.DEPLOY_AUTH_SMOKE_EMAIL ??
    env.DEPLOY_REMINDER_SMOKE_EMAIL ??
    undefined

  if (!options.origin || !options.email || !options.appName || !options.host) {
    throw new Error(
      "Usage: bun scripts/verify-postdeploy.ts <https://app.example.com> <invited-email>",
    )
  }

  assertSafeIdentifier("app", options.appName)
  assertSafeIdentifier("host", options.host)
  options.origin = httpsOrigin(options.origin)
  assertEmail(options.email)

  return options as PostdeployOptions
}

export function postdeployCommands(options: PostdeployOptions) {
  return [
    ["bun", "scripts/verify-deployed-smoke.ts", options.origin],
    ["bun", "scripts/verify-deployed-auth-smoke.ts", options.origin, options.email],
    ["bun", "scripts/verify-deployed-reminder-smoke.ts", options.origin, options.email],
    [
      "bun",
      "scripts/verify-caprover-host.ts",
      "--host",
      options.host,
      "--app",
      options.appName,
      "--expect",
      "running",
    ],
  ]
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

function httpsOrigin(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid deployed URL: ${value}`)
  }

  if (url.protocol !== "https:") {
    throw new Error("Postdeploy URL must use HTTPS")
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Postdeploy URL must be an origin without path, query, or hash")
  }

  return url.origin
}

function assertEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`Invalid smoke email: ${value}`)
  }
}

async function run(command: string[]) {
  console.log(`\n$ ${command.join(" ")}`)
  const child = Bun.spawn(command, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await child.exited

  if (exitCode !== 0) {
    throw new Error(`${command.slice(0, 2).join(" ")} failed with exit code ${exitCode}`)
  }
}

function printUsage() {
  console.log(`Usage: bun scripts/verify-postdeploy.ts <https://app.example.com> <invited-email> [--host meruem] [--app miralab-lms]

Runs the full postdeploy smoke sequence:
- unauthenticated deployed-origin smoke
- authenticated booking CRUD smoke
- start and ending-soon reminder smoke
- CapRover host running/container-cardinality check`)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
