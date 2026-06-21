import { stderr, stdin } from "node:process"
import { createInterface } from "node:readline/promises"

type User = {
  id: string
  email: string
  name?: string
  role?: "admin" | "member"
}

type Machine = {
  id: string
  slug: string
  name: string
  active: boolean
}

type Booking = {
  id: string
  title: string
}

const target = Bun.argv[2] ?? process.env.DEPLOY_AUTH_SMOKE_URL
const email = Bun.argv[3] ?? process.env.DEPLOY_AUTH_SMOKE_EMAIL

if (!target || !email) {
  fail("Usage: bun scripts/verify-deployed-auth-smoke.ts <https://app.example.com> <email>")
}

const origin = normalizeOrigin(target)
const otpCode = await getOtpCode(email)
const { token, user } = await verifyOtpLogin(origin, email, otpCode)
await verifyCurrentUser(origin, token, email)
const machine = await getBookableMachine(origin, token)
const booking = await createSmokeBooking(origin, token, machine, user)
await deleteSmokeBooking(origin, token, booking)

console.log(`verified deployed auth booking smoke: ${origin} as ${email}`)

function normalizeOrigin(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    fail(`Invalid deployed URL: ${value}`)
  }

  if (url.protocol !== "https:" && !isLocalHttp(url)) {
    fail("Deployed auth smoke URL must use HTTPS unless it is localhost")
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

async function getOtpCode(emailAddress: string) {
  await requestJson<{ ok?: boolean }>(origin, "/auth/request-otp", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: emailAddress }),
  })

  const codeFromEnv = process.env.DEPLOY_AUTH_SMOKE_OTP_CODE?.trim()
  if (codeFromEnv) {
    return codeFromEnv
  }

  const readline = createInterface({ input: stdin, output: stderr })
  try {
    return (await readline.question(`Paste OTP code sent to ${emailAddress}: `)).trim()
  } finally {
    readline.close()
  }
}

async function verifyOtpLogin(origin: string, emailAddress: string, code: string) {
  const body = await requestJson<{ token?: string; user?: User }>(origin, "/auth/verify-otp", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: emailAddress, code }),
  })

  if (!body.token) {
    fail("/auth/verify-otp did not return a session token")
  }

  if (body.user?.email !== emailAddress) {
    fail("/auth/verify-otp did not return the expected user")
  }

  return { token: body.token, user: body.user }
}

async function verifyCurrentUser(origin: string, token: string, emailAddress: string) {
  const body = await requestJson<{ user?: User }>(origin, "/auth/me", {
    headers: authHeaders(token),
  })

  if (body.user?.email !== emailAddress) {
    fail("/auth/me did not return the authenticated smoke user")
  }
}

async function getBookableMachine(origin: string, token: string) {
  const body = await requestJson<{ machines?: Machine[] }>(origin, "/machines", {
    headers: authHeaders(token),
  })
  const machine = body.machines?.find((candidate) => candidate.active)

  if (!machine) {
    fail("/machines did not return an active machine for the smoke booking")
  }

  return machine
}

async function createSmokeBooking(origin: string, token: string, machine: Machine, user?: User) {
  const startsAt = nextSmokeSlotStart()
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
  const body = await requestJson<{ booking?: Booking }>(origin, "/bookings", {
    method: "POST",
    headers: authHeaders(token, { "content-type": "application/json" }),
    body: JSON.stringify({
      machineId: machine.id,
      userId: user?.id,
      title: `Deployed auth smoke ${new Date().toISOString()}`,
      notes: "Disposable deployment smoke booking; should be deleted by the verifier.",
      type: "normal",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: "Deployed auth smoke",
    }),
  })

  if (!body.booking?.id) {
    fail("/bookings did not return the created smoke booking")
  }

  return body.booking
}

async function deleteSmokeBooking(origin: string, token: string, booking: Booking) {
  const body = await requestJson<{ ok?: boolean }>(
    origin,
    `/bookings/${encodeURIComponent(booking.id)}?reason=Deployed%20auth%20smoke%20cleanup`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  )

  if (body.ok !== true) {
    fail("/bookings/:id delete did not confirm cleanup")
  }
}

function nextSmokeSlotStart() {
  const start = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)
  start.setUTCHours(3, 0, 0, 0)
  return start
}

function jsonHeaders(init?: Record<string, string>) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...init,
  }
}

function authHeaders(token: string, init?: Record<string, string>) {
  return {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    ...init,
  }
}

async function requestJson<T>(origin: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    fail(`${path} returned ${response.status}${body?.error ? `: ${body.error}` : ""}`)
  }

  return response.json() as Promise<T>
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
