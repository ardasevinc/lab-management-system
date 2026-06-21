import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApiApp } from "../../apps/api/src/app"
import { createTestDb } from "../helpers/db"

let testDb: Awaited<ReturnType<typeof createTestDb>>
let app: ReturnType<typeof createApiApp>

beforeEach(async () => {
  testDb = await createTestDb()
  app = createApiApp({ db: testDb.db })
})

afterEach(() => {
  testDb.close()
})

describe("auth and invites", () => {
  it("rejects OTP requests for uninvited emails", async () => {
    const response = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outsider@example.com" }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Email is not invited" })
  })

  it("lets an admin invite a researcher who can then sign in", async () => {
    const inviteEmails: Array<{ to: string; name: string; role: string; loginUrl: string }> = []
    app = createApiApp({
      db: testDb.db,
      config: { publicAppUrl: "https://lms.miralab.tr" },
      mailer: {
        async sendLoginOtp() {},
        async sendInviteEmail(email) {
          inviteEmails.push(email)
        },
        async sendBookingEmail() {},
      },
    })
    const adminHeaders = await login("admin@miralab.tr")
    const inviteResponse = await app.request("/admin/invites", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        email: "new.member@miralab.tr",
        name: "New Member",
        role: "member",
      }),
    })
    const usersAfterInviteResponse = await app.request("/admin/users", { headers: adminHeaders })

    const otpResponse = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new.member@miralab.tr" }),
    })
    const { devCode } = await otpResponse.json()
    const verifyResponse = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new.member@miralab.tr", code: devCode }),
    })
    const { token, user } = await verifyResponse.json()
    const meResponse = await app.request("/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(inviteResponse.status).toBe(201)
    expect(usersAfterInviteResponse.status).toBe(200)
    expect(await usersAfterInviteResponse.json()).toEqual({
      users: expect.arrayContaining([
        expect.objectContaining({
          email: "new.member@miralab.tr",
          name: "New Member",
          role: "member",
          active: true,
        }),
      ]),
    })
    expect(inviteEmails).toEqual([
      {
        to: "new.member@miralab.tr",
        name: "New Member",
        role: "member",
        loginUrl: "https://lms.miralab.tr/login?email=new.member%40miralab.tr",
      },
    ])
    expect(otpResponse.status).toBe(200)
    expect(verifyResponse.status).toBe(200)
    expect(user).toEqual({
      id: expect.any(String),
      email: "new.member@miralab.tr",
      name: "New Member",
      role: "member",
      active: true,
    })
    expect(await meResponse.json()).toEqual({ user })
  })

  it("invalidates older login codes when a new code is requested", async () => {
    const firstRequest = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr" }),
    })
    const firstCode = (await firstRequest.json()).devCode

    const secondRequest = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr" }),
    })
    const secondCode = (await secondRequest.json()).devCode

    const staleVerify = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr", code: firstCode }),
    })
    const latestVerify = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr", code: secondCode }),
    })

    expect(firstRequest.status).toBe(200)
    expect(secondRequest.status).toBe(200)
    expect(staleVerify.status).toBe(401)
    expect(await staleVerify.json()).toEqual({ error: "Invalid or expired login code" })
    expect(latestVerify.status).toBe(200)
  })

  it("lets admins deactivate and reactivate users", async () => {
    const adminHeaders = await login("admin@miralab.tr")
    const memberHeaders = await login("member@miralab.tr")

    const deactivateResponse = await app.request("/admin/users/member-local", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
    const deactivated = await deactivateResponse.json()
    const meAfterDeactivate = await app.request("/auth/me", {
      headers: memberHeaders,
    })
    const otpAfterDeactivate = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr" }),
    })

    const reactivateResponse = await app.request("/admin/users/member-local", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    const reactivated = await reactivateResponse.json()
    const otpAfterReactivate = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@miralab.tr" }),
    })

    expect(deactivateResponse.status).toBe(200)
    expect(deactivated.user).toEqual(
      expect.objectContaining({
        id: "member-local",
        email: "member@miralab.tr",
        active: false,
      }),
    )
    expect(meAfterDeactivate.status).toBe(401)
    expect(await meAfterDeactivate.json()).toEqual({ error: "Authentication required" })
    expect(otpAfterDeactivate.status).toBe(404)
    expect(await otpAfterDeactivate.json()).toEqual({ error: "Email is not invited" })
    expect(reactivateResponse.status).toBe(200)
    expect(reactivated.user).toEqual(
      expect.objectContaining({
        id: "member-local",
        active: true,
      }),
    )
    expect(otpAfterReactivate.status).toBe(200)
  })

  it("prevents admins from changing their own access", async () => {
    const adminHeaders = await login("admin@miralab.tr")
    const response = await app.request("/admin/users/admin-local", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Admins cannot change their own access" })
  })

  it("lets admins change another user's role", async () => {
    const adminHeaders = await login("admin@miralab.tr")
    const response = await app.request("/admin/users/member-local", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.user).toEqual(
      expect.objectContaining({
        id: "member-local",
        role: "admin",
        active: true,
      }),
    )
  })

  it("sets a secure domain session cookie in production", async () => {
    app = createApiApp({
      db: testDb.db,
      config: {
        appEnv: "production",
        publicAppUrl: "https://lms.miralab.tr",
        corsOrigins: ["https://lms.miralab.tr"],
        sessionCookieSecure: true,
        sessionCookieDomain: ".miralab.tr",
        devShowOtp: false,
      },
    })

    const request = await app.request("/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@miralab.tr" }),
    })
    expect(request.status).toBe(200)
    const code = await latestOtpCode("admin@miralab.tr")
    const verify = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@miralab.tr", code }),
    })

    const setCookie = verify.headers.get("set-cookie")
    expect(verify.status).toBe(200)
    expect(setCookie).toContain("lab_session=")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=Lax")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("Domain=.miralab.tr")
    expect(setCookie).toContain("Path=/")
    expect(setCookie).toContain("Expires=")
  })

  it("clears the same domain cookie shape on logout", async () => {
    app = createApiApp({
      db: testDb.db,
      config: {
        appEnv: "production",
        publicAppUrl: "https://lms.miralab.tr",
        corsOrigins: ["https://lms.miralab.tr"],
        sessionCookieSecure: true,
        sessionCookieDomain: ".miralab.tr",
        devShowOtp: false,
      },
    })

    const { authorization } = await login("admin@miralab.tr")
    const response = await app.request("/auth/logout", {
      method: "POST",
      headers: { authorization },
    })

    const setCookie = response.headers.get("set-cookie")
    expect(response.status).toBe(200)
    expect(setCookie).toContain("lab_session=")
    expect(setCookie).toContain("Max-Age=0")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("Domain=.miralab.tr")
    expect(setCookie).toContain("Path=/")
  })
})

async function login(email: string) {
  const request = await app.request("/auth/request-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  })
  const { devCode } = await request.json()
  const verify = await app.request("/auth/verify-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: devCode }),
  })
  const { token } = await verify.json()

  return { authorization: `Bearer ${token}` }
}

async function latestOtpCode(email: string) {
  const otp = await testDb.db.query.otpCodes.findFirst({
    where: (otpCodes, { eq }) => eq(otpCodes.email, email),
    orderBy: (otpCodes, { desc }) => desc(otpCodes.createdAt),
  })

  if (!otp) {
    throw new Error(`No OTP code found for ${email}`)
  }

  return otp.code
}
