import type { MiddlewareHandler } from "hono"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  testDb = await createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe("web fallback", () => {
  it("serves the SPA for unknown browser navigations", async () => {
    const app = createApiApp({ db: testDb.db, webMiddleware: webFallback })

    const response = await app.request("/definitely-missing", {
      headers: { accept: "text/html" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toContain('<div id="root"></div>')
  })

  it("keeps unknown API requests as 404 when they do not accept HTML", async () => {
    const app = createApiApp({ db: testDb.db, webMiddleware: webFallback })

    const response = await app.request("/definitely-missing")

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("404 Not Found")
  })

  it("serves overlapping client routes as HTML for browser navigations", async () => {
    const app = createApiApp({ db: testDb.db, webMiddleware: webFallback })

    const machinesNavigation = await app.request("/machines", {
      headers: { accept: "text/html" },
    })
    const adminNavigation = await app.request("/admin/users", {
      headers: { accept: "text/html" },
    })

    expect(machinesNavigation.status).toBe(200)
    expect(await machinesNavigation.text()).toContain('<div id="root"></div>')
    expect(adminNavigation.status).toBe(200)
    expect(await adminNavigation.text()).toContain('<div id="root"></div>')
  })

  it("keeps overlapping API routes protected for fetch requests", async () => {
    const app = createApiApp({ db: testDb.db, webMiddleware: webFallback })

    const machinesApi = await app.request("/machines")
    const adminApi = await app.request("/admin/users")

    expect(machinesApi.status).toBe(401)
    expect(await machinesApi.json()).toEqual({ error: "Authentication required" })
    expect(adminApi.status).toBe(401)
    expect(await adminApi.json()).toEqual({ error: "Authentication required" })
  })

  it("serves configured root public assets before the SPA fallback", async () => {
    const app = createApiApp({
      db: testDb.db,
      assetMiddleware: (c) => c.text(`asset:${c.req.path}`),
      webMiddleware: webFallback,
    })

    const favicon = await app.request("/favicon.svg")
    const logo = await app.request("/logo.svg")

    expect(favicon.status).toBe(200)
    expect(await favicon.text()).toBe("asset:/favicon.svg")
    expect(logo.status).toBe(200)
    expect(await logo.text()).toBe("asset:/logo.svg")
  })
})

const webFallback: MiddlewareHandler = (c) =>
  c.html('<!doctype html><html><body><div id="root"></div></body></html>')
