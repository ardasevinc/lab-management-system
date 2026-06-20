import type { Db } from "."
import { invites, machines, users } from "./schema"

export async function seedInitialData(db: Db, now = new Date()) {
  await db
    .insert(users)
    .values([
      {
        id: "admin-local",
        email: "admin@miralab.tr",
        name: "MIRALAB Admin",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "member-local",
        email: "member@miralab.tr",
        name: "MIRALAB Member",
        role: "member",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(invites)
    .values([
      {
        id: "invite-admin-local",
        email: "admin@miralab.tr",
        name: "MIRALAB Admin",
        role: "admin",
        invitedByUserId: "admin-local",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "invite-member-local",
        email: "member@miralab.tr",
        name: "MIRALAB Member",
        role: "member",
        invitedByUserId: "admin-local",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(machines)
    .values({
      id: "tohum",
      slug: "tohum",
      name: "tohum",
      description: "MIRALAB GPU workstation for remote AI training and research sessions.",
      specsJson: JSON.stringify(["NVIDIA GPU workstation"]),
      accessNotes: "Remote access details are shared by lab admins.",
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
}
