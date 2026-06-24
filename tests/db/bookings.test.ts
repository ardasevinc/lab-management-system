import {
  BookingConflictError,
  createBooking,
  deleteBooking,
  listBookingsForMachine,
  StaleBookingError,
  updateBooking,
} from "@lab/db"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  testDb = await createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe("booking repository", () => {
  it("creates and lists bookings for a machine range", async () => {
    const booking = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Training run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T12:00:00.000Z"),
    })

    const bookings = await listBookingsForMachine(
      testDb.db,
      "tohum",
      new Date("2026-05-10T00:00:00.000Z"),
      new Date("2026-05-11T00:00:00.000Z"),
    )

    expect(bookings).toHaveLength(1)
    expect(bookings[0]).toMatchObject({
      id: booking.id,
      machineId: "tohum",
      title: "Training run",
      startsAt: "2026-05-10T10:00:00.000Z",
      endsAt: "2026-05-10T12:00:00.000Z",
    })
  })

  it("rejects overlapping bookings on the same machine", async () => {
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "First run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T12:00:00.000Z"),
    })

    await expect(
      createBooking(testDb.db, {
        machineId: "tohum",
        userId: "member-local",
        actorUserId: "admin-local",
        title: "Overlap",
        startsAt: new Date("2026-05-10T11:30:00.000Z"),
        endsAt: new Date("2026-05-10T12:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BookingConflictError)
  })

  it("enforces non-overlap at the database boundary", async () => {
    const now = Date.parse("2026-05-10T09:00:00.000Z")

    await testDb.client.execute({
      sql: `insert into bookings
        (id, machine_id, user_id, title, type, starts_at, ends_at, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "raw-first",
        "tohum",
        "member-local",
        "Raw first",
        "normal",
        Date.parse("2026-05-10T10:00:00.000Z"),
        Date.parse("2026-05-10T11:00:00.000Z"),
        now,
        now,
      ],
    })

    await expect(
      testDb.client.execute({
        sql: `insert into bookings
          (id, machine_id, user_id, title, type, starts_at, ends_at, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "raw-overlap",
          "tohum",
          "member-local",
          "Raw overlap",
          "normal",
          Date.parse("2026-05-10T10:30:00.000Z"),
          Date.parse("2026-05-10T11:30:00.000Z"),
          now,
          now,
        ],
      }),
    ).rejects.toThrow(/booking_overlap/)
  })

  it("allows adjacent bookings", async () => {
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "First run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T12:00:00.000Z"),
    })

    const next = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Next run",
      startsAt: new Date("2026-05-10T12:00:00.000Z"),
      endsAt: new Date("2026-05-10T13:00:00.000Z"),
    })

    expect(next.title).toBe("Next run")
  })

  it("rejects updates that would overlap another booking", async () => {
    const first = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "First run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Second run",
      startsAt: new Date("2026-05-10T12:00:00.000Z"),
      endsAt: new Date("2026-05-10T13:00:00.000Z"),
    })

    await expect(
      updateBooking(testDb.db, first.id, {
        actorUserId: "admin-local",
        startsAt: new Date("2026-05-10T11:30:00.000Z"),
        endsAt: new Date("2026-05-10T12:30:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(BookingConflictError)
  })

  it("rejects stale update and delete version tokens", async () => {
    const booking = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Versioned run",
      startsAt: new Date("2026-05-10T14:00:00.000Z"),
      endsAt: new Date("2026-05-10T15:00:00.000Z"),
    })

    const updated = await updateBooking(testDb.db, booking.id, {
      actorUserId: "admin-local",
      title: "Versioned run updated",
      expectedUpdatedAt: new Date(booking.updatedAt),
    })

    await expect(
      updateBooking(testDb.db, booking.id, {
        actorUserId: "admin-local",
        title: "Stale update",
        expectedUpdatedAt: new Date(booking.updatedAt),
      }),
    ).rejects.toBeInstanceOf(StaleBookingError)

    await expect(
      deleteBooking(
        testDb.db,
        booking.id,
        "admin-local",
        "stale delete",
        new Date(booking.updatedAt),
      ),
    ).rejects.toBeInstanceOf(StaleBookingError)

    await deleteBooking(
      testDb.db,
      booking.id,
      "admin-local",
      "fresh delete",
      new Date(updated.updatedAt),
    )
  })

  it("frees a booking range after deletion", async () => {
    const booking = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Cancelled run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    await deleteBooking(testDb.db, booking.id, "admin-local", "not needed")

    const replacement = await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Replacement run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    expect(replacement.title).toBe("Replacement run")
  })
})
