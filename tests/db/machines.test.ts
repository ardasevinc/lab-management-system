import {
  ConflictError,
  createBooking,
  createMachine,
  deleteMachine,
  listMachines,
  seedInitialData,
  updateMachine,
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

describe("machine repository", () => {
  it("creates and deletes machines with no booking history", async () => {
    const machine = await createMachine(testDb.db, {
      name: "GPU 2",
      slug: "GPU 2",
      description: "Secondary workstation.",
      specs: ["NVIDIA RTX"],
      accessNotes: "Ask admins.",
    })
    const afterCreate = await listMachines(testDb.db)

    await deleteMachine(testDb.db, machine.id)

    const afterDelete = await listMachines(testDb.db)
    expect(machine).toEqual(
      expect.objectContaining({
        slug: "gpu-2",
        name: "GPU 2",
        active: true,
      }),
    )
    expect(afterCreate).toContainEqual(expect.objectContaining({ id: machine.id }))
    expect(afterDelete).not.toContainEqual(expect.objectContaining({ id: machine.id }))
  })

  it("rejects duplicate machine slugs", async () => {
    await expect(
      createMachine(testDb.db, {
        name: "Another tohum",
        slug: "tohum",
      }),
    ).rejects.toThrow("Machine slug is already in use")
  })

  it("updates machine metadata", async () => {
    const machine = await updateMachine(testDb.db, "tohum", {
      name: "tohum gpu",
      description: "Primary MIRALAB training workstation.",
      specs: ["NVIDIA RTX", "128 GB RAM"],
      accessNotes: "Ask an admin for remote access details.",
      active: false,
    })

    expect(machine).toEqual(
      expect.objectContaining({
        id: "tohum",
        slug: "tohum",
        name: "tohum gpu",
        description: "Primary MIRALAB training workstation.",
        specs: ["NVIDIA RTX", "128 GB RAM"],
        accessNotes: "Ask an admin for remote access details.",
        active: false,
      }),
    )
  })

  it("does not overwrite machine edits when seed data runs again", async () => {
    await updateMachine(testDb.db, "tohum", {
      name: "edited tohum",
      description: "Edited description.",
      active: false,
    })

    await seedInitialData(testDb.db, new Date("2026-05-11T09:00:00.000Z"))

    const machines = await listMachines(testDb.db)
    expect(machines).toContainEqual(
      expect.objectContaining({
        id: "tohum",
        name: "edited tohum",
        description: "Edited description.",
        active: false,
      }),
    )
  })

  it("does not delete machines with booking history", async () => {
    await createBooking(testDb.db, {
      machineId: "tohum",
      userId: "member-local",
      actorUserId: "admin-local",
      title: "Training run",
      startsAt: new Date("2026-05-10T10:00:00.000Z"),
      endsAt: new Date("2026-05-10T11:00:00.000Z"),
    })

    await expect(deleteMachine(testDb.db, "tohum")).rejects.toBeInstanceOf(ConflictError)
  })
})
