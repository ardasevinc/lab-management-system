import { stderr, stdin } from "node:process"
import { createInterface } from "node:readline/promises"

type User = {
  id: string
  email: string
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

type ReminderHealth = {
  enabled?: boolean
  intervalSeconds?: number
  startReminderMinutes?: number
  endingReminderMinutes?: number
}

class SmokeError extends Error {}

const target = Bun.argv[2] ?? process.env.DEPLOY_REMINDER_SMOKE_URL
const email = Bun.argv[3] ?? process.env.DEPLOY_REMINDER_SMOKE_EMAIL

if (!target || !email) {
  fail("Usage: bun scripts/verify-deployed-reminder-smoke.ts <https://app.example.com> <email>")
}

const origin = normalizeOrigin(target)
const health = await verifyReminderHealth(origin)
const otpCode = await getOtpCode(origin, email)
const { token, user } = await verifyOtpLogin(origin, email, otpCode)
await verifyCurrentUser(origin, token, email)
const machine = await getBookableMachine(origin, token)
const booking = await createReminderSmokeBooking(origin, token, machine, user, health)

try {
  await confirmReminderDelivery(email, booking, health)
} finally {
  await deleteSmokeBookingWithRetry(origin, token, booking)
}

console.log(`verified deployed reminder smoke: ${origin} as ${email}`)

function normalizeOrigin(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    fail(`Invalid deployed URL: ${value}`)
  }

  if (url.protocol !== "https:" && !isLocalHttp(url)) {
    fail("Deployed reminder smoke URL must use HTTPS unless it is localhost")
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

async function verifyReminderHealth(origin: string) {
  const body = await requestJson<{
    ok?: boolean
    checks?: {
      database?: string
      machines?: number
      reminders?: ReminderHealth
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

  const reminders = body.checks.reminders
  if (reminders?.enabled !== true) {
    fail("/health did not report reminders enabled")
  }

  assertPositiveNumber(reminders.intervalSeconds, "reminder worker interval")
  assertPositiveNumber(reminders.startReminderMinutes, "start reminder window")
  assertPositiveNumber(reminders.endingReminderMinutes, "ending reminder window")

  return {
    intervalSeconds: reminders.intervalSeconds,
    startReminderMinutes: reminders.startReminderMinutes,
    endingReminderMinutes: reminders.endingReminderMinutes,
  }
}

function assertPositiveNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    fail(`/health did not expose a valid ${label}`)
  }
}

async function getOtpCode(origin: string, emailAddress: string) {
  await requestJson<{ ok?: boolean }>(origin, "/auth/request-otp", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: emailAddress }),
  })

  const codeFromEnv = process.env.DEPLOY_REMINDER_SMOKE_OTP_CODE?.trim()
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
    fail("/machines did not return an active machine for the reminder smoke booking")
  }

  return machine
}

async function createReminderSmokeBooking(
  origin: string,
  token: string,
  machine: Machine,
  user: User | undefined,
  health: { startReminderMinutes: number; endingReminderMinutes: number },
) {
  const startOffsetMinutes = Math.max(1, Math.min(2, health.startReminderMinutes))
  const endOffsetMinutes = Math.min(
    Math.max(startOffsetMinutes + 2, 4),
    health.endingReminderMinutes,
  )

  if (endOffsetMinutes <= startOffsetMinutes) {
    fail("Reminder smoke requires an ending reminder window wider than the start offset")
  }

  const startsAt = soonWithinWindow(health.startReminderMinutes, startOffsetMinutes)
  const endsAt = soonWithinWindow(health.endingReminderMinutes, endOffsetMinutes)
  const title = `Deployed reminder smoke ${new Date().toISOString()}`

  const body = await requestJson<{ booking?: Booking }>(origin, "/bookings", {
    method: "POST",
    headers: authHeaders(token, { "content-type": "application/json" }),
    body: JSON.stringify({
      machineId: machine.id,
      userId: user?.id,
      title,
      notes: "Disposable deployment reminder smoke booking; should be deleted by the verifier.",
      type: "normal",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: "Deployed reminder smoke",
    }),
  })

  if (!body.booking?.id) {
    fail("/bookings did not return the created reminder smoke booking")
  }

  return body.booking
}

function soonWithinWindow(windowMinutes: number, preferredOffsetMinutes: number) {
  const offsetMinutes = Math.max(1, Math.min(preferredOffsetMinutes, windowMinutes))
  const value = new Date(Date.now() + offsetMinutes * 60_000)
  value.setSeconds(0, 0)
  return value
}

async function confirmReminderDelivery(
  emailAddress: string,
  booking: Booking,
  health: { intervalSeconds: number },
) {
  const expectedSubjects = [
    `MIRALAB booking starting soon: ${booking.title}`,
    `MIRALAB booking ending soon: ${booking.title}`,
  ]
  const waitHintSeconds = Math.max(health.intervalSeconds * 2, 90)

  console.error("")
  console.error("Reminder smoke booking created.")
  console.error(`Watch ${emailAddress} for these SES reminder subjects:`)
  for (const subject of expectedSubjects) {
    console.error(`- ${subject}`)
  }
  console.error(`Expected wait: up to about ${waitHintSeconds} seconds after booking creation.`)

  if (process.env.DEPLOY_REMINDER_SMOKE_CONFIRM === "1") {
    return
  }

  const readline = createInterface({ input: stdin, output: stderr })
  try {
    const answer = (
      await readline.question("Type yes after both reminder emails arrive once: ")
    ).trim()
    if (answer.toLowerCase() !== "yes") {
      fail("Reminder delivery was not confirmed")
    }
  } finally {
    readline.close()
  }
}

async function deleteSmokeBooking(origin: string, token: string, booking: Booking) {
  const body = await requestJson<{ ok?: boolean }>(
    origin,
    `/bookings/${encodeURIComponent(booking.id)}?reason=Deployed%20reminder%20smoke%20cleanup`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  )

  if (body.ok !== true) {
    fail("/bookings/:id delete did not confirm reminder smoke cleanup")
  }
}

async function deleteSmokeBookingWithRetry(origin: string, token: string, booking: Booking) {
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await deleteSmokeBooking(origin, token, booking)
      return
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await sleep(750 * attempt)
      }
    }
  }

  fail(
    `Reminder smoke booking ${booking.id} was created but cleanup could not be confirmed after ${maxAttempts} attempts: ${errorMessage(lastError)}`,
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  throw new SmokeError(message)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

process.on("uncaughtException", (error) => {
  console.error(errorMessage(error))
  process.exit(1)
})

process.on("unhandledRejection", (error) => {
  console.error(errorMessage(error))
  process.exit(1)
})
