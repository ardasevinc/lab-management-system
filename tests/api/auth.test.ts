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
    expect(otpResponse.status).toBe(200)
    expect(verifyResponse.status).toBe(200)
    expect(user).toEqual({
      id: expect.any(String),
      email: "new.member@miralab.tr",
      name: "New Member",
      role: "member",
    })
    expect(await meResponse.json()).toEqual({ user })
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
