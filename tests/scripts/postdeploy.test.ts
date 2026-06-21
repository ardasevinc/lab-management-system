import { describe, expect, it } from "vitest"
import { parseArgs, postdeployCommands } from "../../scripts/verify-postdeploy"

describe("postdeploy verifier", () => {
  it("builds the deployed smoke command sequence", () => {
    const options = parseArgs(["https://lms.miralab.tr", "admin@miralab.tr"])

    expect(options).toEqual({
      appName: "miralab-lms",
      email: "admin@miralab.tr",
      host: "meruem",
      origin: "https://lms.miralab.tr",
    })
    expect(postdeployCommands(options)).toEqual([
      ["bun", "scripts/verify-deployed-smoke.ts", "https://lms.miralab.tr"],
      [
        "bun",
        "scripts/verify-deployed-auth-smoke.ts",
        "https://lms.miralab.tr",
        "admin@miralab.tr",
      ],
      [
        "bun",
        "scripts/verify-deployed-reminder-smoke.ts",
        "https://lms.miralab.tr",
        "admin@miralab.tr",
      ],
      [
        "bun",
        "scripts/verify-caprover-host.ts",
        "--host",
        "meruem",
        "--app",
        "miralab-lms",
        "--expect",
        "running",
      ],
    ])
  })

  it("supports env and deployment target overrides", () => {
    expect(
      parseArgs(["--host", "deploy-1", "--app", "miralab-lms-staging"], {
        DEPLOY_POSTDEPLOY_EMAIL: "member@miralab.tr",
        DEPLOY_POSTDEPLOY_URL: "https://staging.miralab.tr",
      }),
    ).toEqual({
      appName: "miralab-lms-staging",
      email: "member@miralab.tr",
      host: "deploy-1",
      origin: "https://staging.miralab.tr",
    })
  })

  it("rejects unsafe host and app identifiers", () => {
    expect(() =>
      parseArgs(["https://lms.miralab.tr", "admin@miralab.tr", "--host", "meruem;rm"]),
    ).toThrow("host contains unsafe characters")
    expect(() =>
      parseArgs(["https://lms.miralab.tr", "admin@miralab.tr", "--app", "miralab-lms $(whoami)"]),
    ).toThrow("app contains unsafe characters")
  })
})
