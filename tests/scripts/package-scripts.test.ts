import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

type PackageJson = {
  scripts?: Record<string, string>
}

describe("package scripts", () => {
  it("starts only the API and web dev servers from the root dev script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson
    const dev = packageJson.scripts?.dev

    expect(dev).toBe("bun run dev:web & bun run dev:api & wait")
    expect(dev).not.toContain("--filter '*'")
  })

  it("keeps the predeploy gate aligned with the deployment runbook", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson
    const predeploy = packageJson.scripts?.["verify:predeploy"]

    expect(predeploy).toBe(
      [
        "bun run verify:caprover-env",
        "bun run verify:caprover-package",
        "bun run verify:docker-build",
        "bun run verify:docker-runtime",
        "bun run check",
        "bun run build",
      ].join(" && "),
    )
  })

  it("keeps the CapRover preflight gate aligned with the deployment runbook", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson
    const preflight = packageJson.scripts?.["verify:caprover-preflight"]

    expect(preflight).toBe(
      [
        "bun run pack:caprover",
        "bun run verify:caprover-env",
        "bun run verify:caprover-package",
        "bun run verify:caprover-dns",
        "bun run verify:caprover-host --expect absent",
      ].join(" && "),
    )
  })

  it("keeps the postdeploy gate on the checked-in smoke orchestrator", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson

    expect(packageJson.scripts?.["verify:postdeploy"]).toBe("bun scripts/verify-postdeploy.ts")
  })

  it("keeps Playwright responsible for building the served app", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson
    const config = readFileSync("playwright.config.ts", "utf8")

    expect(packageJson.scripts?.playwright).toBe("playwright")
    expect(packageJson.scripts?.["test:e2e"]).toBe("playwright test")
    expect(config).toContain('command: "bun run build && bun scripts/start-e2e-server.ts"')
  })
})
