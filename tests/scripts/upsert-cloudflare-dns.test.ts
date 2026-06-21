import { describe, expect, it } from "vitest"
import { parseArgs, upsertCloudflareDnsRecord } from "../../scripts/upsert-cloudflare-dns"

describe("Cloudflare DNS upsert helper", () => {
  it("defaults to the MIRALAB LMS DNS record", () => {
    expect(parseArgs([])).toEqual({
      content: "130.61.34.1",
      name: "lms",
      proxied: true,
      ttl: 1,
      zone: "miralab.tr",
    })
  })

  it("accepts explicit record options", () => {
    expect(
      parseArgs([
        "--zone",
        "example.com",
        "--name",
        "app",
        "--content",
        "203.0.113.10",
        "--ttl",
        "120",
        "--no-proxy",
      ]),
    ).toEqual({
      content: "203.0.113.10",
      name: "app",
      proxied: false,
      ttl: 120,
      zone: "example.com",
    })
  })

  it("rejects unsafe record values", () => {
    expect(() => parseArgs(["--name", "lms.miralab.tr"])).toThrow("--name must be a DNS label")
    expect(() => parseArgs(["--zone", "miralab.tr;rm"])).toThrow("--zone must be a DNS zone name")
    expect(() => parseArgs(["--content", "999.61.34.1"])).toThrow("Invalid IPv4 address")
    expect(() => parseArgs(["--ttl", "0"])).toThrow("--ttl must be a positive integer")
  })

  it("creates the A record when it does not exist", async () => {
    const requests: Array<{ body?: unknown; method: string; path: string }> = []
    const fetcher = mockCloudflareFetch(requests, {
      records: [],
      zones: [{ id: "zone-1", name: "miralab.tr" }],
    })

    await expect(upsertCloudflareDnsRecord(parseArgs([]), "token", fetcher)).resolves.toEqual({
      action: "created",
      message: "created Cloudflare DNS: lms.miralab.tr -> 130.61.34.1",
    })
    expect(requests).toEqual([
      { method: "GET", path: "/client/v4/zones?name=miralab.tr" },
      { method: "GET", path: "/client/v4/zones/zone-1/dns_records?type=A&name=lms.miralab.tr" },
      {
        body: {
          content: "130.61.34.1",
          name: "lms.miralab.tr",
          proxied: true,
          ttl: 1,
          type: "A",
        },
        method: "POST",
        path: "/client/v4/zones/zone-1/dns_records",
      },
    ])
  })

  it("updates the A record when content differs", async () => {
    const requests: Array<{ body?: unknown; method: string; path: string }> = []
    const fetcher = mockCloudflareFetch(requests, {
      records: [
        {
          content: "203.0.113.10",
          id: "record-1",
          name: "lms.miralab.tr",
          proxied: true,
          ttl: 1,
          type: "A",
        },
      ],
      zones: [{ id: "zone-1", name: "miralab.tr" }],
    })

    await expect(upsertCloudflareDnsRecord(parseArgs([]), "token", fetcher)).resolves.toEqual({
      action: "updated",
      message: "updated Cloudflare DNS: lms.miralab.tr -> 130.61.34.1",
    })
    expect(requests.at(-1)).toEqual({
      body: {
        content: "130.61.34.1",
        name: "lms.miralab.tr",
        proxied: true,
        ttl: 1,
        type: "A",
      },
      method: "PUT",
      path: "/client/v4/zones/zone-1/dns_records/record-1",
    })
  })

  it("does nothing when the A record already matches", async () => {
    const requests: Array<{ body?: unknown; method: string; path: string }> = []
    const fetcher = mockCloudflareFetch(requests, {
      records: [
        {
          content: "130.61.34.1",
          id: "record-1",
          name: "lms.miralab.tr",
          proxied: true,
          ttl: 1,
          type: "A",
        },
      ],
      zones: [{ id: "zone-1", name: "miralab.tr" }],
    })

    await expect(upsertCloudflareDnsRecord(parseArgs([]), "token", fetcher)).resolves.toEqual({
      action: "noop",
      message: "Cloudflare DNS already correct: lms.miralab.tr -> 130.61.34.1",
    })
    expect(requests).toHaveLength(2)
  })
})

function mockCloudflareFetch(
  requests: Array<{ body?: unknown; method: string; path: string }>,
  data: {
    records: unknown[]
    zones: unknown[]
  },
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const request = {
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      method: init?.method ?? "GET",
      path: `${url.pathname}${url.search}`,
    }
    requests.push(request)

    if (url.pathname === "/client/v4/zones") {
      return jsonResponse({ result: data.zones, success: true })
    }

    if (url.pathname.endsWith("/dns_records") && init?.method !== "POST") {
      return jsonResponse({ result: data.records, success: true })
    }

    return jsonResponse({ result: request.body, success: true })
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  })
}
