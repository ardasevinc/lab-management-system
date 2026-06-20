import { createHash, randomBytes, randomInt } from "node:crypto"
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm"
import type { Db } from "."
import { AuthError, NotFoundError } from "./errors"
import { mapUser } from "./mappers"
import { invites, otpCodes, sessions, users } from "./schema"

const otpTtlMs = 10 * 60 * 1000
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000

export type UserRole = "admin" | "member"
type PrincipalDb = Pick<Db, "query">

export async function requestLoginOtp(db: Db, emailInput: string, now = new Date()) {
  const email = normalizeEmail(emailInput)
  const principal = await findInvitedPrincipal(db, email)

  if (!principal) {
    throw new NotFoundError("Email is not invited")
  }

  const code = randomOtp()
  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    email,
    code,
    consumedAt: null,
    expiresAt: new Date(now.getTime() + otpTtlMs),
    createdAt: now,
  })

  return { email, code, expiresAt: new Date(now.getTime() + otpTtlMs).toISOString() }
}

export async function verifyLoginOtp(db: Db, emailInput: string, code: string, now = new Date()) {
  const email = normalizeEmail(emailInput)
  const otp = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.email, email),
      eq(otpCodes.code, code),
      isNull(otpCodes.consumedAt),
      gt(otpCodes.expiresAt, now),
    ),
    orderBy: desc(otpCodes.createdAt),
  })

  if (!otp) {
    throw new AuthError("Invalid or expired login code")
  }

  return db.transaction(async (tx) => {
    const principal = await findInvitedPrincipal(tx, email)

    if (!principal) {
      throw new NotFoundError("Email is not invited")
    }

    const existingUser = await tx.query.users.findFirst({ where: eq(users.email, email) })
    const userId = existingUser?.id ?? crypto.randomUUID()
    const userValues = {
      id: userId,
      email,
      name: existingUser?.name ?? principal.name,
      role: existingUser?.role ?? principal.role,
      active: existingUser?.active ?? true,
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    }

    await tx
      .insert(users)
      .values(userValues)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: userValues.name,
          role: userValues.role,
          updatedAt: now,
        },
      })

    if (principal.inviteId) {
      await tx
        .update(invites)
        .set({ acceptedAt: now, updatedAt: now })
        .where(eq(invites.id, principal.inviteId))
    }

    await tx.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, otp.id))

    const token = randomBytes(32).toString("base64url")
    await tx.insert(sessions).values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + sessionTtlMs),
      createdAt: now,
    })

    return {
      token,
      user: mapUser(userValues),
      expiresAt: new Date(now.getTime() + sessionTtlMs).toISOString(),
    }
  })
}

export async function getSessionUser(db: Db, token: string | undefined, now = new Date()) {
  if (!token) {
    return null
  }

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, now)),
  })

  if (!session) {
    return null
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, session.userId), eq(users.active, true)),
  })
  return user ? mapUser(user) : null
}

export async function deleteSession(db: Db, token: string | undefined) {
  if (!token) {
    return
  }

  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)))
}

export async function listUsers(db: Db) {
  const rows = await db.select().from(users).orderBy(asc(users.name))
  return rows.map(mapUser)
}

export async function updateUserAccess(
  db: Db,
  id: string,
  input: { role?: UserRole; active?: boolean },
  now = new Date(),
) {
  const existingUser = await db.query.users.findFirst({ where: eq(users.id, id) })

  if (!existingUser) {
    throw new NotFoundError("User not found")
  }

  const active = input.active ?? existingUser.active
  const role = input.role ?? existingUser.role

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        active,
        role,
        updatedAt: now,
      })
      .where(eq(users.id, id))

    if (!active) {
      await tx.delete(sessions).where(eq(sessions.userId, id))
    }
  })

  return {
    ...mapUser(existingUser),
    active,
    role,
  }
}

export async function createInvite(
  db: Db,
  input: { email: string; name: string; role: UserRole; invitedByUserId: string },
  now = new Date(),
) {
  const email = normalizeEmail(input.email)
  const values = {
    id: crypto.randomUUID(),
    email,
    name: input.name,
    role: input.role,
    invitedByUserId: input.invitedByUserId,
    acceptedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  await db
    .insert(invites)
    .values(values)
    .onConflictDoUpdate({
      target: invites.email,
      set: {
        name: values.name,
        role: values.role,
        invitedByUserId: values.invitedByUserId,
        updatedAt: now,
      },
    })

  return { id: values.id, email, name: values.name, role: values.role, active: true }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function randomOtp() {
  return randomInt(100000, 1000000).toString()
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

async function findInvitedPrincipal(db: PrincipalDb, email: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (user) {
    if (!user.active) {
      return null
    }

    return { name: user.name, role: user.role, inviteId: null }
  }

  const invite = await db.query.invites.findFirst({ where: eq(invites.email, email) })
  if (!invite) {
    return null
  }

  return { name: invite.name, role: invite.role, inviteId: invite.id }
}
