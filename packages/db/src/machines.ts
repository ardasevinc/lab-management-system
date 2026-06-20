import { asc, eq } from "drizzle-orm"
import type { Db } from "."
import { NotFoundError } from "./errors"
import { mapMachine } from "./mappers"
import { machines } from "./schema"

export async function listMachines(db: Db) {
  const rows = await db.select().from(machines).orderBy(asc(machines.name))
  return rows.map(mapMachine)
}

export async function getMachineBySlug(db: Db, slug: string) {
  const row = await db.query.machines.findFirst({
    where: eq(machines.slug, slug),
  })
  return row ? mapMachine(row) : null
}

export async function updateMachine(
  db: Db,
  id: string,
  input: {
    name?: string
    description?: string
    specs?: string[]
    accessNotes?: string
    active?: boolean
  },
  now = new Date(),
) {
  const existingMachine = await db.query.machines.findFirst({ where: eq(machines.id, id) })

  if (!existingMachine) {
    throw new NotFoundError("Machine not found")
  }

  await db
    .update(machines)
    .set({
      name: input.name ?? existingMachine.name,
      description: input.description ?? existingMachine.description,
      specsJson: input.specs ? JSON.stringify(input.specs) : existingMachine.specsJson,
      accessNotes: input.accessNotes ?? existingMachine.accessNotes,
      active: input.active ?? existingMachine.active,
      updatedAt: now,
    })
    .where(eq(machines.id, id))

  const updatedMachine = await db.query.machines.findFirst({ where: eq(machines.id, id) })

  if (!updatedMachine) {
    throw new NotFoundError("Machine not found")
  }

  return mapMachine(updatedMachine)
}
