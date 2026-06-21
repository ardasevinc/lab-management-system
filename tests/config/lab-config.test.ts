import { existsSync } from "node:fs"
import { join } from "node:path"
import { labConfig } from "@lab/config"
import { describe, expect, it } from "vitest"

describe("lab config", () => {
  it("uses deployable MIRALAB app origins and sender defaults", () => {
    expect(labConfig.baseUrl).toBe("https://lms.miralab.tr")
    expect(labConfig.authHero).toEqual({
      eyebrow: "GPU workstation access",
      headline: "Book tohum for research runs.",
    })
    expect(labConfig.email.fromAddress).toBe("no-reply@miralab.tr")
    expect(labConfig.email.supportAddress).toBe("support@miralab.tr")
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
