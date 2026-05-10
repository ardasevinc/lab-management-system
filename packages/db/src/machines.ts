import { asc, eq } from "drizzle-orm"
import type { Db } from "."
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
