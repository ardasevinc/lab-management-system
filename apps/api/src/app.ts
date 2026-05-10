import { labConfig } from "@lab/config"
import {
  BookingConflictError,
  createBooking,
  type Db,
  deleteBooking,
  getMachineBySlug,
  InvalidBookingRangeError,
  listBookingsForMachine,
  listMachines,
  NotFoundError,
  updateBooking,
} from "@lab/db"
import type { Context, MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { z } from "zod"

const bookingBodySchema = z.object({
  machineId: z.string().min(1),
  userId: z.string().min(1).default("member-local"),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  type: z.enum(["normal", "maintenance"]).default("normal"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().nullable().optional(),
})

const bookingPatchSchema = bookingBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

const bookingRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
})

export type ApiAppOptions = {
  db: Db
  assetMiddleware?: MiddlewareHandler
  webMiddleware?: MiddlewareHandler
}

export function createApiApp({ db, assetMiddleware, webMiddleware }: ApiAppOptions) {
  const app = new Hono()

  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  )

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "lab-api",
      lab: labConfig.shortName,
    }),
  )

  app.get("/config/public", (c) => c.json(labConfig))

  app.get("/machines", async (c) => c.json({ machines: await listMachines(db) }))

  app.get("/machines/:slug", async (c) => {
    const machine = await getMachineBySlug(db, c.req.param("slug"))

    if (!machine) {
      return c.json({ error: "Machine not found" }, 404)
    }

    return c.json({ machine })
  })

  app.get("/machines/:slug/bookings", async (c) => {
    const machine = await getMachineBySlug(db, c.req.param("slug"))

    if (!machine) {
      return c.json({ error: "Machine not found" }, 404)
    }

    const range = bookingRangeSchema.safeParse({
      start: c.req.query("start"),
      end: c.req.query("end"),
    })

    if (!range.success) {
      return c.json({ error: "Invalid booking range", issues: range.error.issues }, 400)
    }

    const bookings = await listBookingsForMachine(
      db,
      machine.id,
      new Date(range.data.start),
      new Date(range.data.end),
    )

    return c.json({ bookings })
  })

  app.post("/bookings", async (c) => {
    const body = bookingBodySchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid booking", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const booking = await createBooking(db, {
        ...body.data,
        startsAt: new Date(body.data.startsAt),
        endsAt: new Date(body.data.endsAt),
        actorUserId: actorUserId(c),
      })

      return c.json({ booking }, 201)
    })
  })

  app.patch("/bookings/:id", async (c) => {
    const body = bookingPatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid booking update", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const booking = await updateBooking(db, c.req.param("id"), {
        ...body.data,
        startsAt: body.data.startsAt ? new Date(body.data.startsAt) : undefined,
        endsAt: body.data.endsAt ? new Date(body.data.endsAt) : undefined,
        actorUserId: actorUserId(c),
      })

      return c.json({ booking })
    })
  })

  app.delete("/bookings/:id", async (c) =>
    handleApiResult(c, async () => {
      await deleteBooking(db, c.req.param("id"), actorUserId(c), c.req.query("reason"))
      return c.json({ ok: true })
    }),
  )

  if (assetMiddleware && webMiddleware) {
    app.get("/assets/*", assetMiddleware)
    app.get("/", webMiddleware)
    app.get("*", webMiddleware)
  }

  return app
}

function actorUserId(c: { req: { header: (name: string) => string | undefined } }) {
  return c.req.header("x-lab-user-id") ?? "admin-local"
}

async function handleApiResult(c: Context, fn: () => Promise<Response>) {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return c.json({ error: error.message }, 409)
    }

    if (error instanceof InvalidBookingRangeError) {
      return c.json({ error: error.message }, 400)
    }

    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404)
    }

    throw error
  }
}
