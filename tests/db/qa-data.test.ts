import { listBookingsForMachine, listMachines, listUsers, seedRealisticQaData } from "@lab/db"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  testDb = await createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe("realistic QA data seed", () => {
  it("adds dense local data for browser taste passes", async () => {
    const result = await seedRealisticQaData(testDb.db)
    const users = await listUsers(testDb.db)
    const machines = await listMachines(testDb.db)
    const tohumBookings = await listBookingsForMachine(
      testDb.db,
      "tohum",
      new Date("2026-06-15T00:00:00.000Z"),
      new Date("2026-06-22T00:00:00.000Z"),
    )

    expect(result).toEqual({ users: 5, machines: 2, bookings: 6 })
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "ayse@miralab.tr", role: "member", active: true }),
        expect.objectContaining({ email: "burak@miralab.tr", role: "admin", active: true }),
        expect.objectContaining({ email: "disabled@miralab.tr", active: false }),
      ]),
    )
    expect(machines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "ada", active: true }),
        expect.objectContaining({ slug: "incir", active: false }),
      ]),
    )
    expect(tohumBookings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Vision training run", type: "normal" }),
        expect.objectContaining({ title: "CUDA driver maintenance", type: "maintenance" }),
      ]),
    )
  })

  it("is idempotent for its own QA rows", async () => {
    await seedRealisticQaData(testDb.db)
    await seedRealisticQaData(testDb.db)

    const users = await listUsers(testDb.db)
    const machines = await listMachines(testDb.db)
    const tohumBookings = await listBookingsForMachine(
      testDb.db,
      "tohum",
      new Date("2026-06-15T00:00:00.000Z"),
      new Date("2026-06-22T00:00:00.000Z"),
    )

    expect(users.filter((user) => user.email.endsWith("@miralab.tr"))).toHaveLength(7)
    expect(machines).toHaveLength(3)
    expect(tohumBookings).toHaveLength(5)
  })
})
