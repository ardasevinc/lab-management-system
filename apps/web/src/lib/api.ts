export type User = {
  id: string
  email: string
  name: string
  role: "admin" | "member"
  active: boolean
}

export type Machine = {
  id: string
  slug: string
  name: string
  description: string
  specs: string[]
  accessNotes: string
  active: boolean
}

export type Booking = {
  id: string
  machineId: string
  userId: string
  title: string
  notes: string | null
  type: "normal" | "maintenance"
  startsAt: string
  endsAt: string
}

export type AuditEvent = {
  id: string
  bookingId: string
  actorUserId: string
  eventType: "created" | "updated" | "deleted" | "admin_override"
  reason: string | null
  payload: unknown
  createdAt: string
}

export type ApiHealth = {
  ok: boolean
  service: string
  lab: string
  checks: {
    database: "ok" | "unhealthy"
    machines?: number
    reminders: {
      enabled: boolean
      intervalSeconds: number
      startReminderMinutes: number
      endingReminderMinutes: number
      retryDelayMinutes: number
      maxAttempts: number
    }
  }
}

type ApiErrorBody = {
  error?: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ""
const tokenStorageKey = "lab_session_token"

export function getStoredToken() {
  return window.localStorage.getItem(tokenStorageKey)
}

export function setStoredToken(token: string | null) {
  if (token) {
    window.localStorage.setItem(tokenStorageKey, token)
    return
  }

  window.localStorage.removeItem(tokenStorageKey)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const headers = new Headers(init.headers)

  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`)
  }

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    const body = await readErrorBody(response)
    throw new Error(body.error ?? `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function requestOtp(email: string) {
  return apiFetch<{ ok: true; email: string; devCode?: string; expiresAt: string }>(
    "/auth/request-otp",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  )
}

export async function verifyOtp(email: string, code: string) {
  return apiFetch<{ user: User; token: string; expiresAt: string }>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  })
}

export async function getCurrentSession() {
  return apiFetch<{ user: User | null }>("/auth/session")
}

export async function getApiHealth() {
  return apiFetch<ApiHealth>("/health")
}

export async function logout() {
  try {
    await apiFetch<{ ok: true }>("/auth/logout", { method: "POST" })
  } catch {
    // Local logout must not depend on the server being reachable.
  } finally {
    setStoredToken(null)
  }
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
}
