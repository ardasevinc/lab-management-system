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
  it("sends OTP email and can hide dev codes", async () => {
    const sentEmails: Array<{ to: string; code: string; expiresAt: string }> = []
    app = createApiApp({
      db: testDb.db,
      config: { devShowOtp: false },
      mailer: {
        async sendLoginOtp(email) {
          sentEmails.push(email)
        },
      },
    })

    const response = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@miralab.tr" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      email: "admin@miralab.tr",
      expiresAt: expect.any(String),
    })
    expect(sentEmails).toEqual([
      {
        to: "admin@miralab.tr",
        code: expect.stringMatching(/^\d{6}$/),
        expiresAt: expect.any(String),
      },
    ])
  })

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

  it("requires admin role for maintenance bookings and admin routes", async () => {
    const memberHeaders = await login("member@miralab.tr")
    const maintenanceResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Maintenance",
        type: "maintenance",
        startsAt: "2026-05-10T14:00:00.000Z",
        endsAt: "2026-05-10T15:00:00.000Z",
      }),
    })
    const adminResponse = await app.request("/admin/users", { headers: memberHeaders })

    expect(maintenanceResponse.status).toBe(403)
    expect(adminResponse.status).toBe(403)
  })

  it("lets members manage their own normal bookings", async () => {
    const memberHeaders = await login("member@miralab.tr")
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Member run",
        startsAt: "2026-05-10T16:00:00.000Z",
        endsAt: "2026-05-10T17:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Member run updated",
      }),
    })
    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: memberHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(booking.userId).toBe("member-local")
    expect(updateResponse.status).toBe(200)
    expect((await updateResponse.json()).booking.title).toBe("Member run updated")
    expect(deleteResponse.status).toBe(200)
  })

  it("prevents members from managing another user's bookings", async () => {
    const memberHeaders = await login("member@miralab.tr")
    const createForAdminResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "admin-local",
        title: "Not mine",
        startsAt: "2026-05-10T16:00:00.000Z",
        endsAt: "2026-05-10T17:00:00.000Z",
      }),
    })

    const adminCreateResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "admin-local",
        title: "Admin run",
        startsAt: "2026-05-10T18:00:00.000Z",
        endsAt: "2026-05-10T19:00:00.000Z",
      }),
    })
    const { booking } = await adminCreateResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Take over",
      }),
    })
    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: memberHeaders,
    })

    expect(createForAdminResponse.status).toBe(403)
    expect(await createForAdminResponse.json()).toEqual({
      error: "Admins are required for this booking change",
    })
    expect(adminCreateResponse.status).toBe(201)
    expect(updateResponse.status).toBe(403)
    expect(deleteResponse.status).toBe(403)
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
