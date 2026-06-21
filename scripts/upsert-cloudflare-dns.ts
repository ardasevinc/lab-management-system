type CloudflareDnsOptions = {
  content: string
  name: string
  paBin: string
  proxied: boolean
  token?: string
  tokenItem: string
  ttl: number
  zone: string
}

type CloudflareListResponse<T> = {
  errors?: Array<{ message?: string }>
  result?: T[]
  success?: boolean
}

type CloudflareItemResponse<T> = {
  errors?: Array<{ message?: string }>
  result?: T
  success?: boolean
}

type CloudflareZone = {
  id: string
  name: string
}

type CloudflareDnsRecord = {
  content: string
  id: string
  name: string
  proxied?: boolean
  ttl: number
  type: string
}

const DEFAULT_OPTIONS: CloudflareDnsOptions = {
  content: "130.61.34.1",
  name: "lms",
  paBin: "pa",
  proxied: true,
  tokenItem: "cloudflare/miralab/dns-edit-token",
  ttl: 1,
  zone: "miralab.tr",
}

if (import.meta.main) {
  await main(Bun.argv.slice(2))
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const token = resolveCloudflareToken(options)

  const result = await upsertCloudflareDnsRecord(options, token)
  console.log(result.message)
}

export function parseArgs(args: string[]): CloudflareDnsOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--content":
        options.content = requireValue(arg, value)
        index += 1
        break
      case "--name":
        options.name = requireValue(arg, value)
        index += 1
        break
      case "--no-proxy":
        options.proxied = false
        break
      case "--pa-bin":
        options.paBin = requireValue(arg, value)
        index += 1
        break
      case "--token":
        options.token = requireValue(arg, value)
        index += 1
        break
      case "--token-item":
        options.tokenItem = requireValue(arg, value)
        index += 1
        break
      case "--ttl":
        options.ttl = Number(requireValue(arg, value))
        index += 1
        break
      case "--zone":
        options.zone = requireValue(arg, value)
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

  assertDnsLabel(options.name)
  assertSafeCommandName(options.paBin)
  assertSafePaItem(options.tokenItem)
  assertZoneName(options.zone)
  assertIpv4(options.content)
  if (!Number.isInteger(options.ttl) || options.ttl < 1) {
    throw new Error("--ttl must be a positive integer")
  }

  return options
}

export function resolveCloudflareToken(
  options: Pick<CloudflareDnsOptions, "paBin" | "token" | "tokenItem">,
  env: Record<string, string | undefined> = Bun.env,
  readPaSecret = readPaSecretFromCli,
) {
  if (options.token) {
    return options.token
  }

  const envToken = env.CLOUDFLARE_API_TOKEN?.trim()
  if (envToken) {
    return envToken
  }

  const paToken = readPaSecret(options.paBin, options.tokenItem)?.trim()
  if (paToken) {
    return paToken
  }

  throw new Error(
    `Cloudflare DNS token is required. Set CLOUDFLARE_API_TOKEN or add pa item ${options.tokenItem}.`,
  )
}

export async function upsertCloudflareDnsRecord(
  options: CloudflareDnsOptions,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const zone = await getZone(options.zone, token, fetcher)
  const fqdn = `${options.name}.${options.zone}`
  const existing = await getDnsRecord(zone.id, fqdn, token, fetcher)
  const desired = {
    content: options.content,
    name: fqdn,
    proxied: options.proxied,
    ttl: options.ttl,
    type: "A",
  }

  if (
    existing &&
    existing.content === desired.content &&
    existing.proxied === desired.proxied &&
    existing.ttl === desired.ttl
  ) {
    return {
      action: "noop" as const,
      message: `Cloudflare DNS already correct: ${fqdn} -> ${options.content}`,
    }
  }

  if (existing) {
    await cloudflareFetch<CloudflareDnsRecord>(
      `/zones/${zone.id}/dns_records/${existing.id}`,
      token,
      fetcher,
      {
        body: JSON.stringify(desired),
        method: "PUT",
      },
    )
    return {
      action: "updated" as const,
      message: `updated Cloudflare DNS: ${fqdn} -> ${options.content}`,
    }
  }

  await cloudflareFetch<CloudflareDnsRecord>(`/zones/${zone.id}/dns_records`, token, fetcher, {
    body: JSON.stringify(desired),
    method: "POST",
  })
  return {
    action: "created" as const,
    message: `created Cloudflare DNS: ${fqdn} -> ${options.content}`,
  }
}

async function getZone(zoneName: string, token: string, fetcher: typeof fetch) {
  const response = await cloudflareListFetch<CloudflareZone>(
    `/zones?name=${encodeURIComponent(zoneName)}`,
    token,
    fetcher,
  )
  const zone = response[0]
  if (!zone) {
    throw new Error(`Cloudflare zone not found: ${zoneName}`)
  }

  return zone
}

async function getDnsRecord(zoneId: string, fqdn: string, token: string, fetcher: typeof fetch) {
  const response = await cloudflareListFetch<CloudflareDnsRecord>(
    `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(fqdn)}`,
    token,
    fetcher,
  )
  return response[0] ?? null
}

async function cloudflareListFetch<T>(path: string, token: string, fetcher: typeof fetch) {
  const response = await cloudflareFetch<CloudflareListResponse<T>>(path, token, fetcher)
  return response.result ?? []
}

async function cloudflareFetch<T>(
  path: string,
  token: string,
  fetcher: typeof fetch,
  init?: RequestInit,
): Promise<T> {
  const response = await fetcher(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as
    | CloudflareItemResponse<unknown>
    | CloudflareListResponse<unknown>
    | null

  if (!response.ok || body?.success === false) {
    const message = body?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ")
    throw new Error(message || `Cloudflare API request failed: ${response.status}`)
  }

  return body as T
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function assertDnsLabel(value: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error("--name must be a DNS label")
  }
}

function assertSafeCommandName(value: string) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(value)) {
    throw new Error("--pa-bin contains unsafe characters")
  }
}

function assertSafePaItem(value: string) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(value)) {
    throw new Error("--token-item contains unsafe characters")
  }
}

function assertZoneName(value: string) {
  if (!/^[a-zA-Z0-9.-]+$/.test(value)) {
    throw new Error("--zone must be a DNS zone name")
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

function readPaSecretFromCli(paBin: string, item: string) {
  const result = Bun.spawnSync({
    cmd: [paBin, "show", item],
    stderr: "pipe",
    stdout: "pipe",
  })

  if (!result.success) {
    return null
  }

  return result.stdout.toString()
}

function printUsage() {
  console.log(`Usage: bun scripts/upsert-cloudflare-dns.ts [--zone miralab.tr] [--name lms] [--content 130.61.34.1] [--no-proxy]

Creates or updates the Cloudflare A record needed for the MIRALAB LMS CapRover deployment.
Reads the token from --token, CLOUDFLARE_API_TOKEN, or pa item cloudflare/miralab/dns-edit-token.`)
}
