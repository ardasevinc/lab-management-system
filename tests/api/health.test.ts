import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import { machines } from "../../packages/db/src/schema"
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
        reminders: {
          enabled: false,
          intervalSeconds: 60,
          startReminderMinutes: 15,
          endingReminderMinutes: 15,
          retryDelayMinutes: 5,
          maxAttempts: 3,
        },
      },
    })
  })

  it("reports enabled reminder worker configuration", async () => {
    const app = createApiApp({
      db: testDb.db,
      notificationWorker: {
        enabled: true,
        intervalSeconds: 30,
        startReminderMinutes: 20,
        endingReminderMinutes: 10,
        retryDelayMinutes: 7,
        maxAttempts: 4,
      },
    })
    const response = await app.request("/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        ok: true,
        checks: expect.objectContaining({
          reminders: {
            enabled: true,
            intervalSeconds: 30,
            startReminderMinutes: 20,
            endingReminderMinutes: 10,
            retryDelayMinutes: 7,
            maxAttempts: 4,
          },
        }),
      }),
    )
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
        reminders: {
          enabled: false,
          intervalSeconds: 60,
          startReminderMinutes: 15,
          endingReminderMinutes: 15,
          retryDelayMinutes: 5,
          maxAttempts: 3,
        },
      },
    })
  })

  it("returns 503 when no machine inventory is readable", async () => {
    await testDb.db.delete(machines)

    const app = createApiApp({ db: testDb.db })
    const response = await app.request("/health")

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      ok: false,
      service: "lab-api",
      lab: "MIRALAB",
      checks: {
        database: "ok",
        machines: 0,
        reminders: {
          enabled: false,
          intervalSeconds: 60,
          startReminderMinutes: 15,
          endingReminderMinutes: 15,
          retryDelayMinutes: 5,
          maxAttempts: 3,
        },
      },
    })
  })
})
