import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>
let app: ReturnType<typeof createApiApp>
let authHeaders: HeadersInit

beforeEach(async () => {
  testDb = await createTestDb()
  app = createApiApp({ db: testDb.db })
  authHeaders = await login("admin@miralab.tr")
})

afterEach(() => {
  testDb.close()
})

describe("booking API", () => {
  it("lists seeded machines", async () => {
    const response = await app.request("/machines", { headers: authHeaders })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.machines).toEqual([
      expect.objectContaining({
        id: "tohum",
        slug: "tohum",
        name: "tohum",
      }),
    ])
  })

  it("creates and lists a booking", async () => {
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "API training run",
        startsAt: "2026-05-10T10:00:00.000Z",
        endsAt: "2026-05-10T12:00:00.000Z",
      }),
    })

    expect(createResponse.status).toBe(201)

    const listResponse = await app.request(
      "/machines/tohum/bookings?start=2026-05-10T00:00:00.000Z&end=2026-05-11T00:00:00.000Z",
      { headers: authHeaders },
    )
    const body = await listResponse.json()

    expect(listResponse.status).toBe(200)
    expect(body.bookings).toEqual([
      expect.objectContaining({
        title: "API training run",
        startsAt: "2026-05-10T10:00:00.000Z",
        endsAt: "2026-05-10T12:00:00.000Z",
      }),
    ])
  })

  it("returns 409 for overlapping booking requests", async () => {
    const booking = {
      machineId: "tohum",
      userId: "member-local",
      title: "API training run",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T12:00:00.000Z",
    }

    const first = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify(booking),
    })
    const second = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        ...booking,
        title: "Overlap",
        startsAt: "2026-05-10T11:00:00.000Z",
        endsAt: "2026-05-10T13:00:00.000Z",
      }),
    })

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: "Booking overlaps an existing booking" })
  })

  it("updates and deletes bookings", async () => {
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Original",
        startsAt: "2026-05-10T10:00:00.000Z",
        endsAt: "2026-05-10T11:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Updated",
        startsAt: "2026-05-10T11:00:00.000Z",
        endsAt: "2026-05-10T12:00:00.000Z",
      }),
    })
    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: authHeaders,
    })

    expect(updateResponse.status).toBe(200)
    expect((await updateResponse.json()).booking.title).toBe("Updated")
    expect(deleteResponse.status).toBe(200)
  })

  it("rejects unauthenticated machine access", async () => {
    const response = await app.request("/machines")
    expect(response.status).toBe(401)
  })
})

async function login(email: string) {
  const request = await app.request("/auth/request-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  })
  const { devCode } = await request.json()
  const verify = await app.request("/auth/verify-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: devCode }),
  })
  const { token } = await verify.json()

  return { authorization: `Bearer ${token}` }
}
