import { eq } from "drizzle-orm"
import type { Db } from "."
import { invites, machines, users } from "./schema"

export type BootstrapAdminSeed = {
  email: string
  name: string
}

export type SeedInitialDataOptions = {
  bootstrapAdmin?: BootstrapAdminSeed | null
  requireBootstrapAdmin?: boolean
  seedLocalUsers?: boolean
}

export async function seedInitialData(
  db: Db,
  now = new Date(),
  options: SeedInitialDataOptions = {},
) {
  const seedLocalUsers = options.seedLocalUsers ?? true
  const existingAdmin = await db.query.users.findFirst({ where: eq(users.role, "admin") })

  if (!existingAdmin && options.bootstrapAdmin) {
    await seedBootstrapAdmin(db, options.bootstrapAdmin, now)
  } else if (!existingAdmin && options.requireBootstrapAdmin) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL is required when no admin user exists")
  }

  if (seedLocalUsers) {
    await db
      .insert(users)
      .values({
        id: "admin-local",
        email: "admin@example.org",
        name: "Lab Admin",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: "admin@example.org",
          name: "Lab Admin",
          role: "admin",
          active: true,
          updatedAt: now,
        },
      })

    await db
      .insert(users)
      .values({
        id: "member-local",
        email: "member@example.org",
        name: "Lab Member",
        role: "member",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: "member@example.org",
          name: "Lab Member",
          role: "member",
          active: true,
          updatedAt: now,
        },
      })

    const localAdminId = await fixtureAdminId(db)

    await db
      .insert(invites)
      .values({
        id: "invite-admin-local",
        email: "admin@example.org",
        name: "Lab Admin",
        role: "admin",
        invitedByUserId: localAdminId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: invites.id,
        set: {
          email: "admin@example.org",
          name: "Lab Admin",
          role: "admin",
          invitedByUserId: localAdminId,
          acceptedAt: now,
          updatedAt: now,
        },
      })

    await db
      .insert(invites)
      .values({
        id: "invite-member-local",
        email: "member@example.org",
        name: "Lab Member",
        role: "member",
        invitedByUserId: localAdminId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: invites.id,
        set: {
          email: "member@example.org",
          name: "Lab Member",
          role: "member",
          invitedByUserId: localAdminId,
          acceptedAt: now,
          updatedAt: now,
        },
      })
  }

  await db
    .insert(machines)
    .values({
      id: "tohum",
      slug: "tohum",
      name: "tohum",
      description: "Default GPU workstation for shared research workloads.",
      specsJson: JSON.stringify(["NVIDIA GPU workstation"]),
      accessNotes: "",
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
}

async function fixtureAdminId(db: Db) {
  const admin = await db.query.users.findFirst({ where: eq(users.email, "admin@example.org") })
  if (!admin) {
    throw new Error("Local fixture admin user could not be seeded")
  }

  return admin.id
}

async function seedBootstrapAdmin(db: Db, bootstrapAdmin: BootstrapAdminSeed, now: Date) {
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: "bootstrap-admin",
        email: bootstrapAdmin.email,
        name: bootstrapAdmin.name,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: bootstrapAdmin.name,
          role: "admin",
          active: true,
          updatedAt: now,
        },
      })

    const admin = await tx.query.users.findFirst({ where: eq(users.email, bootstrapAdmin.email) })
    if (!admin) {
      throw new Error("Bootstrap admin user could not be seeded")
    }

    await tx
      .insert(invites)
      .values({
        id: "invite-bootstrap-admin",
        email: bootstrapAdmin.email,
        name: bootstrapAdmin.name,
        role: "admin",
        invitedByUserId: admin.id,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: invites.email,
        set: {
          name: bootstrapAdmin.name,
          role: "admin",
          invitedByUserId: admin.id,
          acceptedAt: now,
          updatedAt: now,
        },
      })
  })
}
