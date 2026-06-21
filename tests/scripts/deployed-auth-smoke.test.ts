import { execFile } from "node:child_process"
import {
  type AddressInfo,
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { promisify } from "node:util"
import { afterEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
let server: ReturnType<typeof createServer> | null = null

afterEach(async () => {
  if (!server) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
  server = null
})

describe("deployed auth smoke verifier", () => {
  it("proves OTP auth plus disposable booking create/delete", async () => {
    const seenRequests: string[] = []
    const origin = await startServer(async (request, response) => {
      seenRequests.push(`${request.method} ${request.url}`)
      const auth = request.headers.authorization

      if (request.method === "POST" && request.url === "/auth/request-otp") {
        expect(await readJson(request)).toEqual({ email: "admin@miralab.tr" })
        return json(response, { ok: true, email: "admin@miralab.tr" })
      }

      if (request.method === "POST" && request.url === "/auth/verify-otp") {
        expect(await readJson(request)).toEqual({
          email: "admin@miralab.tr",
          code: "123456",
        })
        return json(response, {
          token: "smoke-token",
          user: {
            id: "admin-local",
            email: "admin@miralab.tr",
            name: "MIRALAB Admin",
            role: "admin",
          },
        })
      }

      if (auth !== "Bearer smoke-token") {
        response.writeHead(401, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: "Authentication required" }))
        return
      }

      if (request.method === "GET" && request.url === "/auth/me") {
        return json(response, {
          user: {
            id: "admin-local",
            email: "admin@miralab.tr",
            name: "MIRALAB Admin",
            role: "admin",
          },
        })
      }

      if (request.method === "GET" && request.url === "/machines") {
        return json(response, {
          machines: [
            {
              id: "tohum",
              slug: "tohum",
              name: "tohum",
              active: true,
            },
          ],
        })
      }

      if (request.method === "POST" && request.url === "/bookings") {
        const body = (await readJson(request)) as { title?: string; machineId?: string }
        expect(body.machineId).toBe("tohum")
        expect(body.title).toMatch(/^Deployed auth smoke /)
        return json(response, {
          booking: {
            id: "smoke-booking",
            title: body.title,
          },
        })
      }

      if (
        request.method === "DELETE" &&
        request.url === "/bookings/smoke-booking?reason=Deployed%20auth%20smoke%20cleanup"
      ) {
        return json(response, { ok: true })
      }

      response.writeHead(404)
      response.end()
    })

    const { stdout } = await execFileAsync(
      "bun",
      ["scripts/verify-deployed-auth-smoke.ts", origin, "admin@miralab.tr"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DEPLOY_AUTH_SMOKE_OTP_CODE: "123456",
        },
      },
    )

    expect(stdout.trim()).toBe(
      `verified deployed auth booking smoke: ${origin} as admin@miralab.tr`,
    )
    expect(seenRequests).toEqual([
      "POST /auth/request-otp",
      "POST /auth/verify-otp",
      "GET /auth/me",
      "GET /machines",
      "POST /bookings",
      "DELETE /bookings/smoke-booking?reason=Deployed%20auth%20smoke%20cleanup",
    ])
  })

  it("fails when the deployment has no active machine to book", async () => {
    const origin = await startServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/auth/request-otp") {
        return json(response, { ok: true, email: "admin@miralab.tr" })
      }

      if (request.method === "POST" && request.url === "/auth/verify-otp") {
        return json(response, {
          token: "smoke-token",
          user: { id: "admin-local", email: "admin@miralab.tr" },
        })
      }

      if (request.headers.authorization !== "Bearer smoke-token") {
        response.writeHead(401, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: "Authentication required" }))
        return
      }

      if (request.method === "GET" && request.url === "/auth/me") {
        return json(response, { user: { id: "admin-local", email: "admin@miralab.tr" } })
      }

      if (request.method === "GET" && request.url === "/machines") {
        return json(response, { machines: [{ id: "tohum", slug: "tohum", active: false }] })
      }

      response.writeHead(404)
      response.end()
    })

    await expect(
      execFileAsync("bun", ["scripts/verify-deployed-auth-smoke.ts", origin, "admin@miralab.tr"], {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DEPLOY_AUTH_SMOKE_OTP_CODE: "123456",
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "/machines did not return an active machine for the smoke booking",
      ),
    })
  })

  it("retries cleanup when the first smoke booking delete fails", async () => {
    let deleteAttempts = 0
    const origin = await startServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/auth/request-otp") {
        return json(response, { ok: true, email: "admin@miralab.tr" })
      }

      if (request.method === "POST" && request.url === "/auth/verify-otp") {
        return json(response, {
          token: "smoke-token",
          user: { id: "admin-local", email: "admin@miralab.tr" },
        })
      }

      if (request.headers.authorization !== "Bearer smoke-token") {
        response.writeHead(401, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: "Authentication required" }))
        return
      }

      if (request.method === "GET" && request.url === "/auth/me") {
        return json(response, { user: { id: "admin-local", email: "admin@miralab.tr" } })
      }

      if (request.method === "GET" && request.url === "/machines") {
        return json(response, { machines: [{ id: "tohum", slug: "tohum", active: true }] })
      }

      if (request.method === "POST" && request.url === "/bookings") {
        return json(response, { booking: { id: "smoke-booking", title: "Smoke booking" } })
      }

      if (
        request.method === "DELETE" &&
        request.url === "/bookings/smoke-booking?reason=Deployed%20auth%20smoke%20cleanup"
      ) {
        deleteAttempts += 1
        if (deleteAttempts === 1) {
          response.writeHead(500, { "content-type": "application/json" })
          response.end(JSON.stringify({ error: "Temporary cleanup failure" }))
          return
        }

        return json(response, { ok: true })
      }

      response.writeHead(404)
      response.end()
    })

    const { stdout } = await execFileAsync(
      "bun",
      ["scripts/verify-deployed-auth-smoke.ts", origin, "admin@miralab.tr"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DEPLOY_AUTH_SMOKE_OTP_CODE: "123456",
        },
      },
    )

    expect(stdout.trim()).toBe(
      `verified deployed auth booking smoke: ${origin} as admin@miralab.tr`,
    )
    expect(deleteAttempts).toBe(2)
  })
})

async function startServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  server = createServer(handler)

  await new Promise<void>((resolve) => {
    server?.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

function json(response: ServerResponse, body: unknown) {
  response.writeHead(200, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
