import { existsSync } from "node:fs"
import { join } from "node:path"
import { labConfig } from "@lab/config"
import { describe, expect, it } from "vitest"

describe("lab config", () => {
  it("uses neutral FOSS defaults when no deploy branding is configured", () => {
    expect(labConfig.appTitle).toBe("Lab Management System")
    expect(labConfig.labName).toBe("Research Lab")
    expect(labConfig.institutionName).toBe("Your Institution")
    expect(labConfig.shortName).toBe("Lab LMS")
    expect(labConfig.baseUrl).toBe("http://localhost:5173")
    expect(labConfig.authHero).toEqual({
      eyebrow: "Shared lab resource booking",
      headline: "Book lab machines without calendar drift.",
    })
    expect(labConfig.primaryColor).toBe("#007f67")
    expect(labConfig.email.fromAddress).toBe("no-reply@example.org")
    expect(labConfig.email.supportAddress).toBe("support@example.org")
  })

  it("points brand assets at checked-in public files", () => {
    expect(labConfig.logoPath).toBe("/logo.svg")
    expect(labConfig.faviconPath).toBe("/favicon.svg")
    expect(existsSync(publicAssetPath(labConfig.logoPath))).toBe(true)
    expect(existsSync(publicAssetPath(labConfig.faviconPath))).toBe(true)
  })
})

function publicAssetPath(assetPath: string) {
  return join(process.cwd(), "apps/web/public", assetPath.replace(/^\//, ""))
}
