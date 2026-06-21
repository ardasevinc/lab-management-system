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

class SmokeError extends Error {}

const target = Bun.argv[2] ?? process.env.DEPLOY_AUTH_SMOKE_URL
const email = Bun.argv[3] ?? process.env.DEPLOY_AUTH_SMOKE_EMAIL

if (!target || !email) {
  fail("Usage: bun scripts/verify-deployed-auth-smoke.ts <https://app.example.com> <email>")
}

const origin = normalizeOrigin(target)
const otpCode = await getOtpCode(email)
const { token, user, sessionCookie } = await verifyOtpLogin(origin, email, otpCode)
await verifyCurrentUser(origin, token, email)
await verifyCookieSession(origin, sessionCookie, email)
const machine = await getBookableMachine(origin, token)
const booking = await createSmokeBooking(origin, token, machine, user)
await updateSmokeBooking(origin, token, booking)
await deleteSmokeBookingWithRetry(origin, token, booking)

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
  const { body, response } = await requestJsonResponse<{ token?: string; user?: User }>(
    origin,
    "/auth/verify-otp",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: emailAddress, code }),
    },
  )

  if (!body.token) {
    fail("/auth/verify-otp did not return a session token")
  }

  if (body.user?.email !== emailAddress) {
    fail("/auth/verify-otp did not return the expected user")
  }

  const sessionCookie = assertSessionCookie(response.headers.get("set-cookie"), origin)

  return { token: body.token, user: body.user, sessionCookie }
}

async function verifyCurrentUser(origin: string, token: string, emailAddress: string) {
  const body = await requestJson<{ user?: User }>(origin, "/auth/me", {
    headers: authHeaders(token),
  })

  if (body.user?.email !== emailAddress) {
    fail("/auth/me did not return the authenticated smoke user")
  }
}

async function verifyCookieSession(origin: string, sessionCookie: string, emailAddress: string) {
  const body = await requestJson<{ user?: User | null }>(origin, "/auth/session", {
    headers: {
      accept: "application/json",
      cookie: sessionCookie,
    },
  })

  if (body.user?.email !== emailAddress) {
    fail("/auth/session did not return the authenticated smoke user from the session cookie")
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
  const maxAttempts = 7
  let lastConflict: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await createSmokeBookingForSlot(origin, token, machine, attempt, user)
    } catch (error) {
      if (!isBookingConflict(error)) {
        throw error
      }

      lastConflict = error
    }
  }

  fail(
    `Could not create a disposable smoke booking after ${maxAttempts} future slots: ${errorMessage(lastConflict)}`,
  )
}

async function createSmokeBookingForSlot(
  origin: string,
  token: string,
  machine: Machine,
  slotOffsetDays: number,
  user?: User,
) {
  const startsAt = nextSmokeSlotStart(slotOffsetDays)
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

async function updateSmokeBooking(origin: string, token: string, booking: Booking) {
  const body = await requestJson<{ booking?: Booking }>(
    origin,
    `/bookings/${encodeURIComponent(booking.id)}`,
    {
      method: "PATCH",
      headers: authHeaders(token, { "content-type": "application/json" }),
      body: JSON.stringify({
        title: `${booking.title} updated`,
        notes: "Disposable deployment smoke booking updated before verifier cleanup.",
        reason: "Deployed auth smoke update",
      }),
    },
  )

  if (body.booking?.id !== booking.id) {
    fail("/bookings/:id update did not return the smoke booking")
  }

  booking.title = body.booking.title
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
    `Smoke booking ${booking.id} was created but cleanup could not be confirmed after ${maxAttempts} attempts: ${errorMessage(lastError)}`,
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nextSmokeSlotStart(offsetDays: number) {
  const start = new Date(Date.now() + (400 + offsetDays) * 24 * 60 * 60 * 1000)
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
  const { body } = await requestJsonResponse<T>(origin, path, init)
  return body
}

async function requestJsonResponse<T>(
  origin: string,
  path: string,
  init?: RequestInit,
): Promise<{ body: T; response: Response }> {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    fail(`${path} returned ${response.status}${body?.error ? `: ${body.error}` : ""}`)
  }

  return { body: (await response.json()) as T, response }
}

function assertSessionCookie(setCookie: string | null, origin: string) {
  if (!setCookie) {
    fail("/auth/verify-otp did not set the browser session cookie")
  }

  if (!/(^|,\s*)lab_session=/.test(setCookie)) {
    fail("/auth/verify-otp did not set lab_session")
  }

  const attributes = setCookie.toLowerCase()
  for (const attribute of ["httponly", "samesite=lax", "path=/", "expires="]) {
    if (!attributes.includes(attribute)) {
      fail(`/auth/verify-otp session cookie is missing ${attribute}`)
    }
  }

  if (!isLocalHttp(new URL(origin)) && !attributes.includes("secure")) {
    fail("/auth/verify-otp session cookie is missing secure")
  }

  const sessionCookie = setCookie
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("lab_session="))
    ?.split(";")[0]

  if (!sessionCookie) {
    fail("/auth/verify-otp did not expose a usable lab_session cookie value")
  }

  return sessionCookie
}

function fail(message: string): never {
  throw new SmokeError(message)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isBookingConflict(error: unknown) {
  return error instanceof SmokeError && error.message.startsWith("/bookings returned 409")
}

process.on("uncaughtException", (error) => {
  console.error(errorMessage(error))
  process.exit(1)
})

process.on("unhandledRejection", (error) => {
  console.error(errorMessage(error))
  process.exit(1)
})
