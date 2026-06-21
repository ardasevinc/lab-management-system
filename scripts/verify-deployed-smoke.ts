const target = Bun.argv[2] ?? process.env.DEPLOY_SMOKE_URL

if (!target) {
  fail("Usage: bun scripts/verify-deployed-smoke.ts <https://app.example.com>")
}

const origin = normalizeOrigin(target)

await verifyHealth(origin)
const publicConfig = await verifyPublicConfig(origin)
await verifyHtmlRoute(origin, "/")
await verifyHtmlRoute(origin, "/machines")
await verifyHtmlRoute(origin, "/admin/users")
await verifyProtectedApi(origin, "/machines")
await verifyProtectedApi(origin, "/admin/users")
await verifyAsset(origin, publicConfig.logoPath ?? "/logo.svg")
await verifyAsset(origin, publicConfig.faviconPath ?? "/favicon.svg")

console.log(`verified deployed smoke: ${origin}`)

function normalizeOrigin(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    fail(`Invalid deployed URL: ${value}`)
  }

  if (url.protocol !== "https:" && !isLocalHttp(url)) {
    fail("Deployed smoke URL must use HTTPS unless it is localhost")
  }

  url.pathname = ""
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

function isLocalHttp(url: URL) {
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1")
  )
}

function isLocalOrigin(origin: string) {
  return isLocalHttp(new URL(origin))
}

async function verifyHealth(origin: string) {
  const body = await fetchJson<{
    ok?: boolean
    checks?: {
      database?: string
      machines?: number
      reminders?: {
        enabled?: boolean
        intervalSeconds?: number
        startReminderMinutes?: number
        endingReminderMinutes?: number
        retryDelayMinutes?: number
        maxAttempts?: number
      }
    }
  }>(origin, "/health")

  if (body.ok !== true) {
    fail("/health did not report ok: true")
  }

  if (body.checks?.database !== "ok") {
    fail("/health did not report checks.database: ok")
  }

  if (typeof body.checks?.machines !== "number" || body.checks.machines < 1) {
    fail("/health did not report at least one seeded machine")
  }

  if (typeof body.checks?.reminders?.enabled !== "boolean") {
    fail("/health did not expose reminder worker status")
  }

  if (!isLocalOrigin(origin) && body.checks.reminders.enabled !== true) {
    fail("/health did not report reminders enabled for deployed origin")
  }

  assertPositiveNumber(body.checks.reminders.intervalSeconds, "reminder worker interval")
  assertPositiveNumber(body.checks.reminders.startReminderMinutes, "start reminder window")
  assertPositiveNumber(body.checks.reminders.endingReminderMinutes, "ending reminder window")
  assertPositiveNumber(body.checks.reminders.retryDelayMinutes, "reminder retry delay")
  assertPositiveNumber(body.checks.reminders.maxAttempts, "reminder max attempts")
}

function assertPositiveNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    fail(`/health did not expose a valid ${label}`)
  }
}

async function verifyPublicConfig(origin: string) {
  const body = await fetchJson<{ logoPath?: string; faviconPath?: string }>(
    origin,
    "/config/public",
  )

  if (!body.logoPath?.startsWith("/")) {
    fail("/config/public did not expose a root-relative logoPath")
  }

  if (!body.faviconPath?.startsWith("/")) {
    fail("/config/public did not expose a root-relative faviconPath")
  }

  return body
}

async function verifyHtmlRoute(origin: string, path: string) {
  const response = await request(origin, path, {
    headers: { accept: "text/html" },
  })

  if (response.status !== 200) {
    fail(`${path} HTML navigation returned ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/html")) {
    fail(`${path} HTML navigation returned content-type ${contentType || "<missing>"}`)
  }

  const body = await response.text()
  if (!body.includes('id="root"')) {
    fail(`${path} HTML navigation did not return the Vite app shell`)
  }
}

async function verifyProtectedApi(origin: string, path: string) {
  const response = await request(origin, path, {
    headers: { accept: "application/json" },
  })

  if (response.status !== 401) {
    fail(`${path} API request returned ${response.status}; expected 401`)
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (body?.error !== "Authentication required") {
    fail(`${path} API request did not return the expected auth JSON`)
  }
}

async function verifyAsset(origin: string, path: string) {
  const response = await request(origin, path)

  if (response.status !== 200) {
    fail(`${path} returned ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/html")) {
    fail(`${path} returned HTML instead of an asset`)
  }

  if ((await response.text()).length === 0) {
    fail(`${path} returned an empty asset response`)
  }
}

async function fetchJson<T>(origin: string, path: string): Promise<T> {
  const response = await request(origin, path, {
    headers: { accept: "application/json" },
  })

  if (response.status !== 200) {
    fail(`${path} returned ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function request(origin: string, path: string, init?: RequestInit) {
  return fetch(`${origin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  })
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
