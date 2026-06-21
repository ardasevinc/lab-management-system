import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

type PackageJson = {
  scripts?: Record<string, string>
}

describe("package scripts", () => {
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
})
