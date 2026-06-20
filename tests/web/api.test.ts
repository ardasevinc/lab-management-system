import { afterEach, describe, expect, it, vi } from "vitest"
import { getStoredToken, logout, setStoredToken } from "../../apps/web/src/lib/api"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("web api auth helpers", () => {
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

function installBrowserMocks(fetchMock: typeof fetch) {
  const storage = new Map<string, string>()

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } as unknown as Storage,
  })
  vi.stubGlobal("fetch", fetchMock)
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response
}
