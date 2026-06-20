import { asc, count, eq } from "drizzle-orm"
import type { Db } from "."
import { ConflictError, NotFoundError } from "./errors"
import { mapMachine } from "./mappers"
import { bookings, machines } from "./schema"

export type MachineInput = {
  name: string
  slug?: string
  description?: string
  specs?: string[]
  accessNotes?: string
  active?: boolean
}

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

export async function createMachine(db: Db, input: MachineInput, now = new Date()) {
  const slug = normalizeSlug(input.slug || input.name)

  if (!slug) {
    throw new ConflictError("Machine slug is required")
  }

  const existingMachine = await db.query.machines.findFirst({ where: eq(machines.slug, slug) })

  if (existingMachine) {
    throw new ConflictError("Machine slug is already in use")
  }

  const values = {
    id: crypto.randomUUID(),
    slug,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    specsJson: JSON.stringify(input.specs ?? []),
    accessNotes: input.accessNotes?.trim() ?? "",
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(machines).values(values)

  return mapMachine(values)
}

export async function updateMachine(
  db: Db,
  id: string,
  input: Partial<Omit<MachineInput, "slug">>,
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

export async function deleteMachine(db: Db, id: string) {
  const existingMachine = await db.query.machines.findFirst({ where: eq(machines.id, id) })

  if (!existingMachine) {
    throw new NotFoundError("Machine not found")
  }

  const [{ value: bookingCount }] = await db
    .select({ value: count() })
    .from(bookings)
    .where(eq(bookings.machineId, id))

  if (bookingCount > 0) {
    throw new ConflictError("Machine has bookings; deactivate it instead")
  }

  await db.delete(machines).where(eq(machines.id, id))

  return mapMachine(existingMachine)
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
