import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import type { BookingEmail } from "../../apps/api/src/mailer"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>
let app: ReturnType<typeof createApiApp>
let authHeaders: HeadersInit
const testNow = new Date("2026-05-10T09:00:00.000Z")

beforeEach(async () => {
  testDb = await createTestDb()
  app = createApiApp({ db: testDb.db, now: () => testNow })
  authHeaders = await login("admin@example.org")
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
        async sendInviteEmail() {},
        async sendBookingEmail() {},
      },
    })

    const response = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.org" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      email: "admin@example.org",
      expiresAt: expect.any(String),
    })
    expect(sentEmails).toEqual([
      {
        to: "admin@example.org",
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

  it("lets admins edit machine records and blocks new bookings when inactive", async () => {
    const updateResponse = await app.request("/admin/machines/tohum", {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "tohum gpu",
        description: "Primary MIRALAB training workstation.",
        specs: ["NVIDIA RTX", "128 GB RAM", ""],
        accessNotes: "Ask an admin for ZeroTier and SSH details.",
        active: false,
      }),
    })
    const updateBody = await updateResponse.json()
    const machinesResponse = await app.request("/machines", { headers: authHeaders })
    const machinesBody = await machinesResponse.json()
    const bookingResponse = await createBookingRequest({
      title: "Blocked inactive run",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T11:00:00.000Z",
    })

    expect(updateResponse.status).toBe(200)
    expect(updateBody.machine).toEqual(
      expect.objectContaining({
        id: "tohum",
        name: "tohum gpu",
        description: "Primary MIRALAB training workstation.",
        specs: ["NVIDIA RTX", "128 GB RAM"],
        accessNotes: "Ask an admin for ZeroTier and SSH details.",
        active: false,
      }),
    )
    expect(machinesBody.machines).toContainEqual(
      expect.objectContaining({
        id: "tohum",
        name: "tohum gpu",
        active: false,
      }),
    )
    expect(bookingResponse.status).toBe(400)
    expect(await bookingResponse.json()).toEqual({ error: "Machine is not bookable" })
  })

  it("lets admins create and delete unused machines", async () => {
    const createResponse = await app.request("/admin/machines", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        name: "GPU 2",
        slug: "GPU 2",
        description: "Secondary GPU workstation.",
        specs: ["NVIDIA RTX"],
        accessNotes: "Ask admins.",
      }),
    })
    const { machine } = await createResponse.json()
    const duplicateResponse = await app.request("/admin/machines", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "Duplicate GPU", slug: "gpu-2" }),
    })
    const deleteResponse = await app.request(`/admin/machines/${machine.id}`, {
      method: "DELETE",
      headers: authHeaders,
    })
    const machinesResponse = await app.request("/machines", { headers: authHeaders })
    const machinesBody = await machinesResponse.json()

    expect(createResponse.status).toBe(201)
    expect(machine).toEqual(
      expect.objectContaining({
        slug: "gpu-2",
        name: "GPU 2",
        active: true,
      }),
    )
    expect(duplicateResponse.status).toBe(409)
    expect(await duplicateResponse.json()).toEqual({ error: "Machine slug is already in use" })
    expect(deleteResponse.status).toBe(200)
    expect(machinesBody.machines).not.toContainEqual(expect.objectContaining({ id: machine.id }))
  })

  it("creates and lists a booking", async () => {
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "API training run",
        userEmail: "member@example.org",
        userName: "Lab Member",
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
    await expectBookingConflict(second)
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
    await expectBookingConflict(collision)
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
    await expectBookingConflict(contained)
    expect(enveloping.status).toBe(409)
    await expectBookingConflict(enveloping)
    expect(multiple.status).toBe(409)
    await expectBookingConflict(multiple)
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
    await expectBookingConflict(blocked)
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

  it("returns structured stale errors for outdated booking updates and deletes", async () => {
    const createResponse = await createBookingRequest({
      title: "Versioned API run",
      startsAt: "2026-05-10T12:00:00.000Z",
      endsAt: "2026-05-10T13:00:00.000Z",
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Versioned API run updated",
        expectedUpdatedAt: booking.updatedAt,
      }),
    })
    const { booking: updatedBooking } = await updateResponse.json()

    const staleUpdateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Stale browser edit",
        expectedUpdatedAt: booking.updatedAt,
      }),
    })
    const staleDeleteResponse = await app.request(
      `/bookings/${booking.id}?expectedUpdatedAt=${encodeURIComponent(booking.updatedAt)}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    )
    const freshDeleteResponse = await app.request(
      `/bookings/${booking.id}?expectedUpdatedAt=${encodeURIComponent(updatedBooking.updatedAt)}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    )

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(staleUpdateResponse.status).toBe(409)
    expect(await staleUpdateResponse.json()).toEqual({
      error: "Booking changed since it was opened",
      code: "stale_booking",
    })
    expect(staleDeleteResponse.status).toBe(409)
    expect(await staleDeleteResponse.json()).toEqual({
      error: "Booking changed since it was opened",
      code: "stale_booking",
    })
    expect(freshDeleteResponse.status).toBe(200)
  })

  it("blocks rescheduling bookings while their machine is inactive", async () => {
    const createResponse = await createBookingRequest({
      title: "Inactive machine existing run",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T11:00:00.000Z",
    })
    const { booking } = await createResponse.json()

    const deactivateResponse = await app.request("/admin/machines/tohum", {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    const titleOnlyResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "Inactive machine title edit" }),
    })
    const rescheduleResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-05-10T11:00:00.000Z",
        endsAt: "2026-05-10T12:00:00.000Z",
      }),
    })

    expect(createResponse.status).toBe(201)
    expect(deactivateResponse.status).toBe(200)
    expect(titleOnlyResponse.status).toBe(200)
    expect((await titleOnlyResponse.json()).booking.title).toBe("Inactive machine title edit")
    expect(rescheduleResponse.status).toBe(400)
    expect(await rescheduleResponse.json()).toEqual({ error: "Machine is not bookable" })
  })

  it("does not delete machines with booking history", async () => {
    const createResponse = await createBookingRequest({
      title: "Machine history",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T11:00:00.000Z",
    })
    const deleteResponse = await app.request("/admin/machines/tohum", {
      method: "DELETE",
      headers: authHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(deleteResponse.status).toBe(409)
    expect(await deleteResponse.json()).toEqual({
      error: "Machine has bookings; deactivate it instead",
    })
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
    const adminAuditResponse = await app.request("/admin/booking-audit?limit=10", {
      headers: authHeaders,
    })
    const adminAuditBody = await adminAuditResponse.json()

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    expect(auditResponse.status).toBe(200)
    expect(adminAuditResponse.status).toBe(200)
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
    expect(adminAuditBody.events).toHaveLength(3)
    expect(adminAuditBody.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      "deleted",
      "updated",
      "created",
    ])
    expect(adminAuditBody.events[0]).toEqual(
      expect.objectContaining({
        actor: expect.objectContaining({
          email: "admin@example.org",
          name: "Lab Admin",
        }),
        owner: expect.objectContaining({
          email: "member@example.org",
          name: "Lab Member",
        }),
        machine: expect.objectContaining({
          id: "tohum",
          name: "tohum",
        }),
        booking: expect.objectContaining({
          id: booking.id,
          deletedAt: expect.any(String),
          title: "Audited run updated",
        }),
      }),
    )
  })

  it("sends booking change emails for create, update, and delete", async () => {
    const sentBookingEmails: BookingEmail[] = []
    app = createApiApp({
      db: testDb.db,
      config: {
        publicAppUrl: "https://lms.miralab.tr",
        corsOrigins: ["https://lms.miralab.tr"],
      },
      mailer: {
        async sendLoginOtp() {},
        async sendInviteEmail() {},
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
      "Lab LMS booking created: Notification run",
      "Lab LMS booking updated: Notification run updated",
      "Lab LMS booking deleted: Notification run updated",
    ])
    expect(sentBookingEmails.map((email) => email.to)).toEqual([
      "member@example.org",
      "member@example.org",
      "member@example.org",
    ])
    expect(sentBookingEmails.map((email) => email.actionUrl)).toEqual([
      "https://lms.miralab.tr/schedule",
      "https://lms.miralab.tr/schedule",
      "https://lms.miralab.tr/schedule",
    ])
  })

  it("notifies both previous and assigned owners when admins reassign a booking", async () => {
    const sentBookingEmails: BookingEmail[] = []
    app = createApiApp({
      db: testDb.db,
      mailer: {
        async sendLoginOtp() {},
        async sendInviteEmail() {},
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
        userId: "admin-local",
        title: "Reassigned notification run",
        startsAt: "2026-05-10T14:00:00.000Z",
        endsAt: "2026-05-10T15:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()
    await waitForBookingEmails(sentBookingEmails, 1)

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        userId: "member-local",
        reason: "Assign to researcher",
      }),
    })
    await waitForBookingEmails(sentBookingEmails, 3)

    const reassignmentEmails = sentBookingEmails.slice(1)

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(sentBookingEmails[0]).toEqual(
      expect.objectContaining({
        to: "admin@example.org",
        subject: "Lab LMS booking created: Reassigned notification run",
      }),
    )
    expect(reassignmentEmails.map((email) => email.to).sort()).toEqual([
      "admin@example.org",
      "member@example.org",
    ])
    expect(reassignmentEmails.map((email) => email.subject)).toEqual([
      "Lab LMS booking updated: Reassigned notification run",
      "Lab LMS booking updated: Reassigned notification run",
    ])
  })

  it("rejects unauthenticated machine access", async () => {
    const response = await app.request("/machines")
    expect(response.status).toBe(401)
  })

  it("requires admin role for maintenance bookings and admin routes", async () => {
    const memberHeaders = await login("member@example.org")
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
    const machineResponse = await app.request("/admin/machines/tohum", {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    const machineCreateResponse = await app.request("/admin/machines", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "GPU 2" }),
    })
    const machineDeleteResponse = await app.request("/admin/machines/tohum", {
      method: "DELETE",
      headers: memberHeaders,
    })

    expect(maintenanceResponse.status).toBe(403)
    expect(adminResponse.status).toBe(403)
    expect(machineResponse.status).toBe(403)
    expect(machineCreateResponse.status).toBe(403)
    expect(machineDeleteResponse.status).toBe(403)
  })

  it("lets members manage their own normal bookings", async () => {
    const memberHeaders = await login("member@example.org")
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

  it("prevents members from creating or moving bookings into the past", async () => {
    const memberHeaders = await login("member@example.org")
    const pastCreateResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Past member run",
        startsAt: "2026-05-10T08:00:00.000Z",
        endsAt: "2026-05-10T08:30:00.000Z",
      }),
    })
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Future member run",
        startsAt: "2026-05-10T16:00:00.000Z",
        endsAt: "2026-05-10T17:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const pastMoveResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-05-10T08:30:00.000Z",
        endsAt: "2026-05-10T09:30:00.000Z",
      }),
    })

    expect(pastCreateResponse.status).toBe(403)
    expect(await pastCreateResponse.json()).toEqual({
      error: "Bookings cannot start in the past",
    })
    expect(createResponse.status).toBe(201)
    expect(pastMoveResponse.status).toBe(403)
    expect(await pastMoveResponse.json()).toEqual({
      error: "Bookings cannot start in the past",
    })
  })

  it("lets members change and delete already-started bookings during the 24 hour window", async () => {
    const memberHeaders = await login("member@example.org")
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Started member run",
        startsAt: "2026-05-10T08:00:00.000Z",
        endsAt: "2026-05-10T10:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const titleEditResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "Started member run edited" }),
    })
    const moveLaterResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-05-10T10:00:00.000Z",
        endsAt: "2026-05-10T11:00:00.000Z",
      }),
    })
    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: memberHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(titleEditResponse.status).toBe(200)
    expect((await titleEditResponse.json()).booking.title).toBe("Started member run edited")
    expect(moveLaterResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
  })

  it("prevents members from changing or deleting bookings more than 24 hours after start", async () => {
    app = createApiApp({
      db: testDb.db,
      now: () => new Date("2026-05-11T09:01:00.000Z"),
    })
    authHeaders = await login("admin@example.org")
    const memberHeaders = await login("member@example.org")
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Old member run",
        startsAt: "2026-05-10T08:00:00.000Z",
        endsAt: "2026-05-10T09:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({ title: "Too late" }),
    })
    const deleteResponse = await app.request(`/bookings/${booking.id}`, {
      method: "DELETE",
      headers: memberHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(403)
    expect(await updateResponse.json()).toEqual({
      error: "Bookings can only be changed within 24 hours after they start",
    })
    expect(deleteResponse.status).toBe(403)
    expect(await deleteResponse.json()).toEqual({
      error: "Bookings can only be changed within 24 hours after they start",
    })
  })

  it("validates booking text field lengths", async () => {
    const longTitleResponse = await createBookingRequest({
      title: "x".repeat(121),
      startsAt: "2026-05-10T16:00:00.000Z",
      endsAt: "2026-05-10T17:00:00.000Z",
    })
    const longNotesResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Long notes",
        notes: "x".repeat(2001),
        startsAt: "2026-05-10T16:00:00.000Z",
        endsAt: "2026-05-10T17:00:00.000Z",
      }),
    })

    expect(longTitleResponse.status).toBe(400)
    expect((await longTitleResponse.json()).error).toBe("Invalid booking")
    expect(longNotesResponse.status).toBe(400)
    expect((await longNotesResponse.json()).error).toBe("Invalid booking")
  })

  it("prevents members from managing another user's bookings", async () => {
    const memberHeaders = await login("member@example.org")
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

  it("lets admins reassign a booking owner", async () => {
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "admin-local",
        title: "Owner handoff",
        startsAt: "2026-05-10T20:00:00.000Z",
        endsAt: "2026-05-10T21:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        userId: "member-local",
        reason: "Assign to researcher",
      }),
    })
    const updateBody = await updateResponse.json()
    const auditResponse = await app.request(`/bookings/${booking.id}/audit`, {
      headers: authHeaders,
    })
    const { events } = await auditResponse.json()

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(200)
    expect(updateBody.booking.userId).toBe("member-local")
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "updated",
        reason: "Assign to researcher",
        payload: expect.objectContaining({
          before: expect.objectContaining({ userId: "admin-local" }),
          after: expect.objectContaining({ userId: "member-local" }),
        }),
      }),
    )
  })

  it("blocks assigning bookings to disabled users", async () => {
    const disableResponse = await app.request("/admin/users/member-local", {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    const createForDisabled = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "member-local",
        title: "Disabled owner create",
        startsAt: "2026-05-10T21:00:00.000Z",
        endsAt: "2026-05-10T22:00:00.000Z",
      }),
    })
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        userId: "admin-local",
        title: "Disabled owner handoff",
        startsAt: "2026-05-10T22:00:00.000Z",
        endsAt: "2026-05-10T23:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const reassignToDisabled = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        userId: "member-local",
      }),
    })

    expect(disableResponse.status).toBe(200)
    expect(createForDisabled.status).toBe(400)
    expect(await createForDisabled.json()).toEqual({ error: "Booking owner is not active" })
    expect(createResponse.status).toBe(201)
    expect(reassignToDisabled.status).toBe(400)
    expect(await reassignToDisabled.json()).toEqual({ error: "Booking owner is not active" })
  })

  it("prevents members from reassigning their own bookings", async () => {
    const memberHeaders = await login("member@example.org")
    const createResponse = await app.request("/bookings", {
      method: "POST",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        machineId: "tohum",
        title: "Member-owned run",
        startsAt: "2026-05-10T22:00:00.000Z",
        endsAt: "2026-05-10T23:00:00.000Z",
      }),
    })
    const { booking } = await createResponse.json()

    const updateResponse = await app.request(`/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { ...memberHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        userId: "admin-local",
      }),
    })

    expect(createResponse.status).toBe(201)
    expect(updateResponse.status).toBe(403)
    expect(await updateResponse.json()).toEqual({
      error: "Admins are required for this booking change",
    })
  })

  it("requires admin role for booking audit history", async () => {
    const memberHeaders = await login("member@example.org")
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
    const memberAdminAuditResponse = await app.request("/admin/booking-audit", {
      headers: memberHeaders,
    })

    expect(createResponse.status).toBe(201)
    expect(memberAuditResponse.status).toBe(403)
    expect(await memberAuditResponse.json()).toEqual({ error: "Admin role required" })
    expect(memberAdminAuditResponse.status).toBe(403)
    expect(await memberAdminAuditResponse.json()).toEqual({ error: "Admin role required" })
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

async function expectBookingConflict(response: Response) {
  expect(await response.json()).toEqual({
    error: "Booking overlaps an existing booking",
    code: "booking_conflict",
  })
}
