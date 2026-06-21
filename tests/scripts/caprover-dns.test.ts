import { describe, expect, it } from "vitest"
import {
  evaluateDns,
  hostnameFromOrigin,
  parseArgs,
  parseEnvFile,
  publicAppUrlFromEnv,
} from "../../scripts/verify-caprover-dns"

describe("CapRover DNS verifier", () => {
  it("defaults to the deployment template and meruem", () => {
    expect(parseArgs([])).toEqual({
      envPath: "deploy/caprover.env.example",
      expectedHost: "meruem",
    })
  })

  it("accepts explicit origin and expected IPv4", () => {
    expect(
      parseArgs(["--origin", "https://lms.miralab.tr", "--expected-ip", "130.61.34.1"]),
    ).toEqual({
      envPath: "deploy/caprover.env.example",
      expectedHost: "meruem",
      expectedIp: "130.61.34.1",
      origin: "https://lms.miralab.tr",
    })
  })

  it("rejects unsafe host aliases and invalid IPv4 values", () => {
    expect(() => parseArgs(["--expected-host", "meruem;reboot"])).toThrow(
      "expected host contains unsafe characters",
    )
    expect(() => parseArgs(["--expected-ip", "999.61.34.1"])).toThrow(
      "Invalid IPv4 address: 999.61.34.1",
    )
  })

  it("extracts PUBLIC_APP_URL from dotenv-like contents", () => {
    const env = parseEnvFile(
      "# comment\nAPP_ENV=production\nPUBLIC_APP_URL=https://lms.miralab.tr\n",
    )

    expect(env.PUBLIC_APP_URL).toBe("https://lms.miralab.tr")
    expect(publicAppUrlFromEnv("PUBLIC_APP_URL=https://lms.miralab.tr\n")).toBe(
      "https://lms.miralab.tr",
    )
  })

  it("requires an HTTPS origin", () => {
    expect(hostnameFromOrigin("https://lms.miralab.tr")).toBe("lms.miralab.tr")
    expect(() => hostnameFromOrigin("http://lms.miralab.tr")).toThrow(
      "PUBLIC_APP_URL must use HTTPS for CapRover DNS verification",
    )
  })

  it("fails when the app hostname has no A records", () => {
    expect(
      evaluateDns({
        expectedIp: "130.61.34.1",
        hostname: "lms.miralab.tr",
        records: { ipv4: [], ipv6: [] },
      }),
    ).toEqual({ ok: false, message: "lms.miralab.tr has no A records" })
  })

  it("fails when A records do not include the CapRover host", () => {
    expect(
      evaluateDns({
        expectedIp: "130.61.34.1",
        hostname: "lms.miralab.tr",
        records: { ipv4: ["203.0.113.10"], ipv6: [] },
      }),
    ).toEqual({
      ok: false,
      message: "lms.miralab.tr A records 203.0.113.10 do not include 130.61.34.1",
    })
  })

  it("passes when A records include the CapRover host", () => {
    expect(
      evaluateDns({
        expectedIp: "130.61.34.1",
        hostname: "lms.miralab.tr",
        records: { ipv4: ["130.61.34.1"], ipv6: [] },
      }),
    ).toEqual({ ok: true, message: "lms.miralab.tr resolves to 130.61.34.1" })
  })
})
