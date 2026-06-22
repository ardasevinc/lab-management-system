import { afterEach, describe, expect, it, vi } from "vitest"
import {
  apiFetch,
  getStoredToken,
  logout,
  resolveApiBaseUrl,
  setStoredToken,
  verifyOtp,
} from "../../apps/web/src/lib/api"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("web api auth helpers", () => {
  it("rewrites a loopback API URL to the current LAN host in dev", () => {
    const location = { hostname: "seele.local" } as Pick<Location, "hostname">

    expect(resolveApiBaseUrl("http://localhost:3001", location)).toBe("http://seele.local:3001")
    expect(resolveApiBaseUrl("http://127.0.0.1:3001", location)).toBe("http://seele.local:3001")
    expect(resolveApiBaseUrl("http://[::1]:3001", location)).toBe("http://seele.local:3001")
  })

  it("keeps explicit non-loopback API URLs unchanged", () => {
    expect(
      resolveApiBaseUrl("https://lms.miralab.tr/api", {
        hostname: "seele.local",
      } as Pick<Location, "hostname">),
    ).toBe("https://lms.miralab.tr/api")
  })

  it("does not rewrite loopback API URLs when the dev rewrite is disabled", () => {
    expect(
      resolveApiBaseUrl(
        "http://localhost:3001",
        { hostname: "lms.miralab.tr" } as Pick<Location, "hostname">,
        false,
      ),
    ).toBe("http://localhost:3001")
  })

  it("does not rewrite when the page is already on loopback", () => {
    expect(
      resolveApiBaseUrl("http://localhost:3001", { hostname: "localhost" } as Pick<
        Location,
        "hostname"
      >),
    ).toBe("http://localhost:3001")
  })

  it("uses cookie credentials without sending a bearer token by default", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user: testUser }))
    installBrowserMocks(fetchMock)

    await apiFetch("/auth/me")

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)

    expect(init.credentials).toBe("include")
    expect(headers.has("authorization")).toBe(false)
  })

  it("keeps the bearer fallback for explicitly seeded tokens", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ user: testUser }))
    installBrowserMocks(fetchMock)
    setStoredToken("manual-session-token")

    await apiFetch("/auth/me")

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)

    expect(init.credentials).toBe("include")
    expect(headers.get("authorization")).toBe("Bearer manual-session-token")
  })

  it("does not persist the returned session token after otp verification", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: testUser,
        token: "server-session-token",
        expiresAt: "2026-06-21T12:00:00.000Z",
      }),
    )
    installBrowserMocks(fetchMock)

    const session = await verifyOtp("admin@example.org", "123456")

    expect(session.token).toBe("server-session-token")
    expect(getStoredToken()).toBeNull()
  })

  it("clears the stored token after a successful logout request", async () => {
    installBrowserMocks(vi.fn(async () => jsonResponse({ ok: true })))
    setStoredToken("session-token")

    await logout()

    expect(getStoredToken()).toBeNull()
  })

  it("clears the stored token even when the logout request fails", async () => {
    installBrowserMocks(vi.fn(async () => jsonResponse({ error: "server unavailable" }, false)))
    setStoredToken("session-token")

    await expect(logout()).resolves.toBeUndefined()
    expect(getStoredToken()).toBeNull()
  })
})

function installBrowserMocks(fetchMock: typeof fetch, location = { hostname: "localhost" }) {
  const storage = new Map<string, string>()

  vi.stubGlobal("window", {
    location,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } as unknown as Storage,
  })
  vi.stubGlobal("fetch", fetchMock)
}

const testUser = {
  id: "admin",
  email: "admin@example.org",
  name: "Lab Admin",
  role: "admin",
  active: true,
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response
}
