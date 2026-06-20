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

describe("health endpoint", () => {
  it("reports database readiness", async () => {
    const app = createApiApp({ db: testDb.db })
    const response = await app.request("/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      service: "lab-api",
      lab: "MIRALAB",
      checks: {
        database: "ok",
        machines: 1,
      },
    })
  })

  it("returns 503 when the database check fails", async () => {
    const app = createApiApp({
      db: {
        select() {
          throw new Error("database unavailable")
        },
      } as never,
    })
    const response = await app.request("/health")

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      ok: false,
      service: "lab-api",
      lab: "MIRALAB",
      checks: {
        database: "unhealthy",
      },
    })
  })
})
