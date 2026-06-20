import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import type { BookingEmail } from "../../apps/api/src/mailer"
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

  it("allows adjacent bookings but rejects update collisions", async () => {
    const morning = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Morning run",
        startsAt: "2026-05-10T09:00:00.000Z",
        endsAt: "2026-05-10T10:00:00.000Z",
      }),
    })
    const adjacent = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Adjacent run",
        startsAt: "2026-05-10T10:00:00.000Z",
        endsAt: "2026-05-10T11:00:00.000Z",
      }),
    })
    const { booking } = await adjacent.json()

    const collision = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-05-10T09:30:00.000Z",
        endsAt: "2026-05-10T10:30:00.000Z",
      }),
    })

    expect(morning.status).toBe(201)
    expect(adjacent.status).toBe(201)
    expect(collision.status).toBe(409)
    expect(await collision.json()).toEqual({ error: "Booking overlaps an existing booking" })
  })

  it("rejects contained and enveloping overlaps while allowing gaps", async () => {
    const early = await createBookingRequest({
      title: "Early dense run",
      startsAt: "2026-05-10T08:00:00.000Z",
      endsAt: "2026-05-10T09:00:00.000Z",
    })
    const middle = await createBookingRequest({
      title: "Middle dense run",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T12:00:00.000Z",
    })
    const late = await createBookingRequest({
      title: "Late dense run",
      startsAt: "2026-05-10T13:00:00.000Z",
      endsAt: "2026-05-10T14:00:00.000Z",
    })

    const contained = await createBookingRequest({
      title: "Contained conflict",
      startsAt: "2026-05-10T10:30:00.000Z",
      endsAt: "2026-05-10T11:00:00.000Z",
    })
    const enveloping = await createBookingRequest({
      title: "Enveloping conflict",
      startsAt: "2026-05-10T09:30:00.000Z",
      endsAt: "2026-05-10T12:30:00.000Z",
    })
    const multiple = await createBookingRequest({
      title: "Multi booking conflict",
      startsAt: "2026-05-10T08:30:00.000Z",
      endsAt: "2026-05-10T13:30:00.000Z",
    })
    const gap = await createBookingRequest({
      title: "Gap run",
      startsAt: "2026-05-10T09:00:00.000Z",
      endsAt: "2026-05-10T10:00:00.000Z",
    })

    expect(early.status).toBe(201)
    expect(middle.status).toBe(201)
    expect(late.status).toBe(201)
    expect(contained.status).toBe(409)
    expect(await contained.json()).toEqual({ error: "Booking overlaps an existing booking" })
    expect(enveloping.status).toBe(409)
    expect(await enveloping.json()).toEqual({ error: "Booking overlaps an existing booking" })
    expect(multiple.status).toBe(409)
    expect(await multiple.json()).toEqual({ error: "Booking overlaps an existing booking" })
    expect(gap.status).toBe(201)
  })

  it("allows only one winner for simultaneous overlapping create requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createBookingRequest({
          title: `Concurrent run ${index + 1}`,
          startsAt: "2026-05-18T10:00:00.000Z",
          endsAt: "2026-05-18T11:00:00.000Z",
        }),
      ),
    )
    const statuses = responses.map((response) => response.status)

    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(7)
  })

  it("treats maintenance blocks as reserved time and frees deleted slots", async () => {
    const maintenance = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Driver upgrade",
        type: "maintenance",
        startsAt: "2026-05-10T12:00:00.000Z",
        endsAt: "2026-05-10T13:00:00.000Z",
      }),
    })
    const { booking } = await maintenance.json()

    const blocked = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Training during maintenance",
        startsAt: "2026-05-10T12:15:00.000Z",
        endsAt: "2026-05-10T12:45:00.000Z",
      }),
    })
    const deleteMaintenance = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: authHeaders,
    })
    const afterDelete = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Training after maintenance",
        startsAt: "2026-05-10T12:15:00.000Z",
        endsAt: "2026-05-10T12:45:00.000Z",
      }),
    })

    expect(maintenance.status).toBe(201)
    expect(blocked.status).toBe(409)
    expect(await blocked.json()).toEqual({ error: "Booking overlaps an existing booking" })
    expect(deleteMaintenance.status).toBe(200)
    expect(afterDelete.status).toBe(201)
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

  it("records admin-readable audit events for booking changes", async () => {
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Audited run",
        startsAt: "2026-05-10T15:00:00.000Z",
        endsAt: "2026-05-10T16:00:00.000Z",
        reason: "Initial request",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Audited run updated",
        reason: "Researcher changed the slot title",
      }),
    })
    const deleteResponse = await app.request(
      `/bookings/${booking.id}?reason=${encodeURIComponent("Cancelled by admin")}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    )
    const auditResponse = await app.request(`/bookings/${booking.id}/audit`, {
      headers: authHeaders,
    })
    const { events } = await auditResponse.json()

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    expect(auditResponse.status).toBe(200)
    expect(events.map((event: { eventType: string }) => event.eventType)).toEqual([
      "created",
      "updated",
      "deleted",
    ])
    expect(events).toEqual([
      expect.objectContaining({
        actorUserId: "admin-local",
        eventType: "created",
        reason: "Initial request",
        payload: expect.objectContaining({
          title: "Audited run",
          userId: "member-local",
        }),
      }),
      expect.objectContaining({
        actorUserId: "admin-local",
        eventType: "updated",
        reason: "Researcher changed the slot title",
        payload: expect.objectContaining({
          before: expect.objectContaining({
            title: "Audited run",
          }),
          after: expect.objectContaining({
            title: "Audited run updated",
          }),
        }),
      }),
      expect.objectContaining({
        actorUserId: "admin-local",
        eventType: "deleted",
        reason: "Cancelled by admin",
        payload: expect.objectContaining({
          title: "Audited run updated",
        }),
      }),
    ])
  })

  it("sends booking change emails for create, update, and delete", async () => {
    const sentBookingEmails: BookingEmail[] = []
    app = createApiApp({
      db: testDb.db,
      mailer: {
        async sendLoginOtp() {},
        async sendBookingEmail(email) {
          sentBookingEmails.push(email)
        },
      },
    })

    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Notification run",
        startsAt: "2026-05-10T13:00:00.000Z",
        endsAt: "2026-05-10T14:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()
    await waitForBookingEmails(sentBookingEmails, 1)

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Notification run updated",
      }),
    })
    await waitForBookingEmails(sentBookingEmails, 2)

    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: authHeaders,
    })
    await waitForBookingEmails(sentBookingEmails, 3)

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    expect(sentBookingEmails.map((email) => email.subject)).toEqual([
      "MIRALAB booking created: Notification run",
      "MIRALAB booking updated: Notification run updated",
      "MIRALAB booking deleted: Notification run updated",
    ])
    expect(sentBookingEmails.map((email) => email.to)).toEqual([
      "member@miralab.tr",
      "member@miralab.tr",
      "member@miralab.tr",
    ])
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

  it("requires admin role for booking audit history", async () => {
    const memberHeaders = await login("member@miralab.tr")
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Private audit run",
        startsAt: "2026-05-10T20:00:00.000Z",
        endsAt: "2026-05-10T21:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const memberAuditResponse = await app.request(`/bookings/${booking.id}/audit`, {
      headers: memberHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(memberAuditResponse.status).toBe(403)
    expect(await memberAuditResponse.json()).toEqual({ error: "Admin role required" })
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

function createBookingRequest(input: {
  title: string
  startsAt: string
  endsAt: string
  machineId?: string
  userId?: string
}) {
  return app.request("/bookings", {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      machineId: input.machineId ?? "tohum",
      userId: input.userId ?? "member-local",
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
  })
}

async function waitForBookingEmails(emails: BookingEmail[], count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (emails.length >= count) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
