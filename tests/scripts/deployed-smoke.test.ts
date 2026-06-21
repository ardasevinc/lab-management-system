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

describe("deployed smoke verifier", () => {
  it("accepts a same-origin deployment shape", async () => {
    const origin = await startServer((request, response) => {
      if (request.url === "/health") {
        return json(response, {
          ok: true,
          checks: {
            database: "ok",
            machines: 1,
            reminders: { enabled: false, intervalSeconds: 60 },
          },
        })
      }

      if (request.url === "/config/public") {
        return json(response, {
          logoPath: "/logo.svg",
          faviconPath: "/favicon.svg",
        })
      }

      if (request.url === "/logo.svg" || request.url === "/favicon.svg") {
        response.writeHead(200, { "content-type": "image/svg+xml" })
        response.end("<svg />")
        return
      }

      if (request.url === "/machines" || request.url === "/admin/users") {
        if (request.headers.accept?.includes("text/html")) {
          return html(response)
        }

        response.writeHead(401, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: "Authentication required" }))
        return
      }

      if (request.url === "/") {
        return html(response)
      }

      response.writeHead(404)
      response.end()
    })

    const { stdout } = await execFileAsync("bun", ["scripts/verify-deployed-smoke.ts", origin], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "test" },
    })

    expect(stdout.trim()).toBe(`verified deployed smoke: ${origin}`)
  })

  it("rejects unhealthy seeded machine state", async () => {
    const origin = await startServer((request, response) => {
      if (request.url === "/health") {
        return json(response, {
          ok: false,
          checks: {
            database: "ok",
            machines: 0,
            reminders: { enabled: true, intervalSeconds: 60 },
          },
        })
      }

      response.writeHead(404)
      response.end()
    })

    await expect(
      execFileAsync("bun", ["scripts/verify-deployed-smoke.ts", origin], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test" },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("/health did not report ok: true"),
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

function html(response: ServerResponse) {
  response.writeHead(200, { "content-type": "text/html" })
  response.end('<!doctype html><html><body><div id="root"></div></body></html>')
}
