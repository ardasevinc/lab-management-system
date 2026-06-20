import { listMachines, seedInitialData, updateMachine } from "@lab/db"
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
})
