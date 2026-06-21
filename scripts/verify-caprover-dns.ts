import { resolve4, resolve6 } from "node:dns/promises"

type DnsOptions = {
  envPath: string
  expectedHost: string
  expectedIp?: string
  origin?: string
}

const DEFAULT_OPTIONS: DnsOptions = {
  envPath: "deploy/caprover.env.example",
  expectedHost: "meruem",
}

if (import.meta.main) {
  await main(Bun.argv.slice(2))
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const origin = options.origin ?? publicAppUrlFromEnv(await Bun.file(options.envPath).text())
  const hostname = hostnameFromOrigin(origin)
  const expectedIp = options.expectedIp ?? (await publicIpv4ForHost(options.expectedHost))
  const records = await resolveDns(hostname)

  const result = evaluateDns({ expectedIp, hostname, records })
  if (!result.ok) {
    fail(result.message)
  }

  const ipv6Summary = records.ipv6.length > 0 ? `, AAAA ${records.ipv6.join(",")}` : ""
  console.log(
    `verified CapRover DNS: ${hostname} A ${records.ipv4.join(",")} includes ${expectedIp}${ipv6Summary}`,
  )
}

export function parseArgs(args: string[]): DnsOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--env":
        options.envPath = requireValue(arg, value)
        index += 1
        break
      case "--expected-host":
        options.expectedHost = requireValue(arg, value)
        index += 1
        break
      case "--expected-ip":
        options.expectedIp = requireValue(arg, value)
        index += 1
        break
      case "--origin":
        options.origin = requireValue(arg, value)
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

  assertSafeHostAlias(options.expectedHost)
  if (options.expectedIp) {
    assertIpv4(options.expectedIp)
  }

  return options
}

export function publicAppUrlFromEnv(contents: string) {
  const env = parseEnvFile(contents)
  const publicAppUrl = env.PUBLIC_APP_URL
  if (!publicAppUrl) {
    throw new Error("PUBLIC_APP_URL is required")
  }

  return publicAppUrl
}

export function parseEnvFile(contents: string) {
  const parsed: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const equalsIndex = line.indexOf("=")
    if (equalsIndex <= 0) {
      continue
    }

    parsed[line.slice(0, equalsIndex)] = line.slice(equalsIndex + 1)
  }

  return parsed
}

export function hostnameFromOrigin(origin: string) {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    throw new Error(`Invalid PUBLIC_APP_URL: ${origin}`)
  }

  if (url.protocol !== "https:") {
    throw new Error("PUBLIC_APP_URL must use HTTPS for CapRover DNS verification")
  }

  return url.hostname
}

export function evaluateDns(input: {
  expectedIp: string
  hostname: string
  records: { ipv4: string[]; ipv6: string[] }
}) {
  if (input.records.ipv4.length === 0) {
    return { ok: false, message: `${input.hostname} has no A records` }
  }

  if (!input.records.ipv4.includes(input.expectedIp)) {
    return {
      ok: false,
      message: `${input.hostname} A records ${input.records.ipv4.join(",")} do not include ${input.expectedIp}`,
    }
  }

  return { ok: true, message: `${input.hostname} resolves to ${input.expectedIp}` }
}

async function resolveDns(hostname: string) {
  const ipv4 = await resolve4(hostname).catch(() => [])
  const ipv6 = await resolve6(hostname).catch(() => [])
  return { ipv4, ipv6 }
}

async function publicIpv4ForHost(host: string) {
  const result = Bun.spawnSync({
    cmd: [
      "ssh",
      host,
      "curl -4 -fsS ifconfig.me 2>/dev/null || curl -4 -fsS https://api.ipify.org 2>/dev/null",
    ],
    stderr: "pipe",
    stdout: "pipe",
  })

  if (!result.success) {
    throw new Error(result.stderr.toString().trim() || `Could not resolve public IPv4 for ${host}`)
  }

  const value = result.stdout.toString().trim()
  assertIpv4(value)
  return value
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function assertSafeHostAlias(value: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error("expected host contains unsafe characters")
  }
}

function assertIpv4(value: string) {
  const parts = value.split(".")
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d+$/.test(part) || Number(part) < 0 || Number(part) > 255)
  ) {
    throw new Error(`Invalid IPv4 address: ${value}`)
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage: bun scripts/verify-caprover-dns.ts [--env deploy/caprover.env.example] [--expected-host meruem] [--expected-ip 130.61.34.1] [--origin https://lms.miralab.tr]

Checks that PUBLIC_APP_URL resolves to the CapRover host public IPv4 before
attempting/declaring a real deployment reachable.`)
}
