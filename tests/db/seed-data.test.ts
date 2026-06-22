import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDatabaseClient, createDbFromClient, migrate, seedInitialData } from "@lab/db"
import { describe, expect, it } from "vitest"

describe("seed initial data", () => {
  it("keeps local fixture users by default", async () => {
    const testDb = await createEmptyTestDb()

    try {
      await seedInitialData(testDb.db, now())

      await expectUser(testDb.db, "admin@miralab.tr", {
        name: "MIRALAB Admin",
        role: "admin",
      })
      await expectUser(testDb.db, "member@miralab.tr", {
        name: "MIRALAB Member",
        role: "member",
      })
    } finally {
      testDb.close()
    }
  })

  it("requires bootstrap admin when production seeding a fresh database", async () => {
    const testDb = await createEmptyTestDb()

    try {
      await expect(
        seedInitialData(testDb.db, now(), {
          requireBootstrapAdmin: true,
          seedLocalUsers: false,
        }),
      ).rejects.toThrow("BOOTSTRAP_ADMIN_EMAIL is required when no admin user exists")
    } finally {
      testDb.close()
    }
  })

  it("seeds only the configured bootstrap admin for production installs", async () => {
    const testDb = await createEmptyTestDb()

    try {
      await seedInitialData(testDb.db, now(), {
        bootstrapAdmin: {
          email: "arda@example.com",
          name: "Arda Sevinc",
        },
        requireBootstrapAdmin: true,
        seedLocalUsers: false,
      })

      await expectUser(testDb.db, "arda@example.com", {
        name: "Arda Sevinc",
        role: "admin",
      })
      expect(await testDb.db.query.users.findFirst()).toEqual(
        expect.objectContaining({
          email: "arda@example.com",
        }),
      )
      expect(
        await testDb.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, "admin@miralab.tr"),
        }),
      ).toBeUndefined()
      expect(
        await testDb.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, "member@miralab.tr"),
        }),
      ).toBeUndefined()
      expect(
        await testDb.db.query.machines.findFirst({
          where: (machines, { eq }) => eq(machines.slug, "tohum"),
        }),
      ).toEqual(expect.objectContaining({ name: "tohum" }))
    } finally {
      testDb.close()
    }
  })

  it("does not rewrite an existing admin on later production starts", async () => {
    const testDb = await createEmptyTestDb()

    try {
      await seedInitialData(testDb.db, now(), {
        bootstrapAdmin: {
          email: "arda@example.com",
          name: "Arda Sevinc",
        },
        requireBootstrapAdmin: true,
        seedLocalUsers: false,
      })

      await seedInitialData(testDb.db, new Date("2026-05-11T09:00:00.000Z"), {
        bootstrapAdmin: {
          email: "next@example.com",
          name: "Next Admin",
        },
        requireBootstrapAdmin: true,
        seedLocalUsers: false,
      })

      await expectUser(testDb.db, "arda@example.com", {
        name: "Arda Sevinc",
        role: "admin",
      })
      expect(
        await testDb.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.email, "next@example.com"),
        }),
      ).toBeUndefined()
    } finally {
      testDb.close()
    }
  })
})

function now() {
  return new Date("2026-05-10T09:00:00.000Z")
}

async function createEmptyTestDb() {
  const tempDir = mkdtempSync(join(tmpdir(), "lab-management-seed-test-"))
  const client = createDatabaseClient(`file:${join(tempDir, "test.sqlite")}`)
  await migrate(client)
  const db = createDbFromClient(client)

  return {
    db,
    close: () => {
      client.close()
      rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

async function expectUser(
  db: Awaited<ReturnType<typeof createEmptyTestDb>>["db"],
  email: string,
  expected: { name: string; role: "admin" | "member" },
) {
  expect(
    await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    }),
  ).toEqual(expect.objectContaining(expected))
}
