import {
  createInvite,
  createMachine,
  type Db,
  deleteMachine,
  ForbiddenError,
  type getSessionUser,
  listAdminBookingAuditEvents,
  listUsers,
  updateMachine,
  updateUserAccess,
} from "@lab/db"
import type { Hono, MiddlewareHandler } from "hono"
import { z } from "zod"
import { handleApiResult } from "./api-errors"
import { type ApiRuntimeConfig, isEmailAllowedByDomains } from "./env"
import type { Mailer } from "./mailer"

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
type AdminRouteApp = Hono<{ Variables: { user: CurrentUser } }>

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "member"]).default("member"),
})

const userAccessPatchSchema = z
  .object({
    role: z.enum(["admin", "member"]).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

const machinePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    specs: z.array(z.string()).optional(),
    accessNotes: z.string().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")

const machineCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  specs: z.array(z.string()).optional(),
  accessNotes: z.string().optional(),
  active: z.boolean().optional(),
})

const bookingAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export function registerAdminRoutes(
  app: AdminRouteApp,
  options: {
    db: Db
    mailer: Mailer
    publicAppUrl: ApiRuntimeConfig["publicAppUrl"]
    allowedEmailDomains: ApiRuntimeConfig["allowedEmailDomains"]
    requireAuth: MiddlewareHandler<{ Variables: { user: CurrentUser } }>
  },
) {
  const { db, mailer, publicAppUrl, allowedEmailDomains, requireAuth } = options

  for (const path of [
    "/admin/users",
    "/admin/users/*",
    "/admin/machines",
    "/admin/machines/*",
    "/admin/invites",
    "/admin/booking-audit",
  ]) {
    app.use(path, requireAuth)
    app.use(path, async (c, next) => {
      assertAdmin(c.get("user"))
      await next()
    })
  }

  app.get("/admin/users", async (c) => c.json({ users: await listUsers(db) }))

  app.get("/admin/booking-audit", async (c) => {
    const query = bookingAuditQuerySchema.safeParse(c.req.query())

    if (!query.success) {
      return c.json({ error: "Invalid audit query", issues: query.error.issues }, 400)
    }

    return c.json({
      events: await listAdminBookingAuditEvents(db, { limit: query.data.limit }),
    })
  })

  app.post("/admin/machines", async (c) => {
    const body = machineCreateSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid machine", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const machine = await createMachine(db, sanitizeMachineInput(body.data))
      return c.json({ machine }, 201)
    })
  })

  app.patch("/admin/machines/:id", async (c) => {
    const body = machinePatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid machine update", issues: body.error.issues }, 400)
    }

    return handleApiResult(c, async () => {
      const machine = await updateMachine(db, c.req.param("id"), sanitizeMachineInput(body.data))
      return c.json({ machine })
    })
  })

  app.delete("/admin/machines/:id", async (c) =>
    handleApiResult(c, async () => {
      const machine = await deleteMachine(db, c.req.param("id"))
      return c.json({ machine })
    }),
  )

  app.patch("/admin/users/:id", async (c) => {
    const body = userAccessPatchSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid user update", issues: body.error.issues }, 400)
    }

    const currentUser = c.get("user")

    if (c.req.param("id") === currentUser.id) {
      throw new ForbiddenError("Admins cannot change their own access")
    }

    return handleApiResult(c, async () => {
      const user = await updateUserAccess(db, c.req.param("id"), body.data)
      return c.json({ user })
    })
  })

  app.post("/admin/invites", async (c) => {
    const body = inviteSchema.safeParse(await c.req.json())

    if (!body.success) {
      return c.json({ error: "Invalid invite", issues: body.error.issues }, 400)
    }

    if (!isEmailAllowedByDomains(body.data.email, allowedEmailDomains)) {
      throw new ForbiddenError("Email domain is not allowed")
    }

    const invite = await createInvite(db, {
      ...body.data,
      invitedByUserId: c.get("user").id,
    })
    await mailer.sendInviteEmail({
      to: invite.email,
      name: invite.name,
      role: invite.role,
      loginUrl: loginUrlForInvite(publicAppUrl, invite.email),
    })

    return c.json({ invite }, 201)
  })
}

function loginUrlForInvite(publicAppUrl: string, email: string) {
  const url = new URL("/login", publicAppUrl)
  url.searchParams.set("email", email)
  return url.toString()
}

function assertAdmin(user: CurrentUser) {
  if (user.role !== "admin") {
    throw new ForbiddenError("Admin role required")
  }
}

function sanitizeMachineInput<T extends { specs?: string[]; name?: string; slug?: string }>(
  input: T,
) {
  return {
    ...input,
    name: input.name?.trim(),
    slug: input.slug?.trim(),
    specs: input.specs?.map((spec) => spec.trim()).filter(Boolean),
  }
}
