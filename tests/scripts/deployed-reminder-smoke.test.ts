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

describe("deployed reminder smoke verifier", () => {
  it("creates a reminder-window booking and requires human delivery confirmation", async () => {
    const seenRequests: string[] = []
    const origin = await startServer(async (request, response) => {
      seenRequests.push(`${request.method} ${request.url}`)
      const auth = request.headers.authorization

      if (request.method === "GET" && request.url === "/health") {
        return json(response, {
          ok: true,
          checks: {
            database: "ok",
            machines: 1,
            reminders: reminderHealth(true),
          },
        })
      }

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
        const body = (await readJson(request)) as {
          machineId?: string
          userId?: string
          title?: string
          startsAt?: string
          endsAt?: string
          reason?: string
        }
        expect(body.machineId).toBe("tohum")
        expect(body.userId).toBe("admin-local")
        expect(body.title).toMatch(/^Deployed reminder smoke /)
        expect(body.reason).toBe("Deployed reminder smoke")
        expect(new Date(body.endsAt ?? 0).getTime()).toBeGreaterThan(
          new Date(body.startsAt ?? 0).getTime(),
        )
        return json(response, {
          booking: {
            id: "reminder-smoke-booking",
            title: body.title,
          },
        })
      }

      if (
        request.method === "DELETE" &&
        request.url ===
          "/bookings/reminder-smoke-booking?reason=Deployed%20reminder%20smoke%20cleanup"
      ) {
        return json(response, { ok: true })
      }

      response.writeHead(404)
      response.end()
    })

    const { stdout, stderr } = await execFileAsync(
      "bun",
      ["scripts/verify-deployed-reminder-smoke.ts", origin, "admin@miralab.tr"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          DEPLOY_REMINDER_SMOKE_OTP_CODE: "123456",
          DEPLOY_REMINDER_SMOKE_CONFIRM: "1",
        },
      },
    )

    expect(stdout.trim()).toBe(`verified deployed reminder smoke: ${origin} as admin@miralab.tr`)
    expect(stderr).toContain("MIRALAB booking starting soon: Deployed reminder smoke")
    expect(stderr).toContain("MIRALAB booking ending soon: Deployed reminder smoke")
    expect(seenRequests).toEqual([
      "GET /health",
      "POST /auth/request-otp",
      "POST /auth/verify-otp",
      "GET /auth/me",
      "GET /machines",
      "POST /bookings",
      "DELETE /bookings/reminder-smoke-booking?reason=Deployed%20reminder%20smoke%20cleanup",
    ])
  })

  it("rejects deployments without enabled reminders", async () => {
    const origin = await startServer((request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        return json(response, {
          ok: true,
          checks: {
            database: "ok",
            machines: 1,
            reminders: reminderHealth(false),
          },
        })
      }

      response.writeHead(404)
      response.end()
    })

    await expect(
      execFileAsync(
        "bun",
        ["scripts/verify-deployed-reminder-smoke.ts", origin, "admin@miralab.tr"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_ENV: "test",
            DEPLOY_REMINDER_SMOKE_OTP_CODE: "123456",
            DEPLOY_REMINDER_SMOKE_CONFIRM: "1",
          },
        },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("/health did not report reminders enabled"),
    })
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

function reminderHealth(enabled: boolean) {
  return {
    enabled,
    intervalSeconds: 60,
    startReminderMinutes: 15,
    endingReminderMinutes: 15,
    retryDelayMinutes: 5,
    maxAttempts: 3,
  }
}
