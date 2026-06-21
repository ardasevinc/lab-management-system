import { describe, expect, it } from "vitest"
import {
  checkArchiveManifest,
  defaultOutputPath,
  formatManifestError,
  normalizeArchiveEntry,
  parseArgs,
} from "../../scripts/pack-caprover"

describe("CapRover package builder", () => {
  it("defaults to a clean HEAD archive under .tmp", () => {
    expect(parseArgs([])).toEqual({ allowDirty: false })
    expect(defaultOutputPath("8120eee")).toBe(".tmp/caprover/miralab-lms-8120eee.tar.gz")
  })

  it("accepts output and dirty-tree overrides", () => {
    expect(parseArgs(["--allow-dirty", "--out", ".tmp/custom.tar.gz"])).toEqual({
      allowDirty: true,
      outputPath: ".tmp/custom.tar.gz",
    })
  })

  it("normalizes git archive entries", () => {
    expect(normalizeArchiveEntry("./captain-definition")).toBe("captain-definition")
    expect(normalizeArchiveEntry("apps/web/.env.production")).toBe("apps/web/.env.production")
  })

  it("accepts the expected deployment archive manifest", () => {
    expect(
      checkArchiveManifest([
        "captain-definition",
        "Dockerfile",
        "package.json",
        "bun.lock",
        "apps/api/package.json",
        "apps/api/src/index.ts",
        "apps/web/package.json",
        "apps/web/.env.production",
        "packages/config/package.json",
        "packages/db/package.json",
        "packages/domain/package.json",
      ]),
    ).toEqual({ missing: [], presentForbidden: [] })
  })

  it("rejects archives missing deploy files or containing local-only artifacts", () => {
    const check = checkArchiveManifest([
      "captain-definition",
      "Dockerfile",
      "package.json",
      "apps/api/package.json",
      "apps/api/src/index.ts",
      "apps/api/.env",
      "apps/web/package.json",
      "apps/web/.env.production",
      "node_modules/.bin/vite",
      "packages/config/package.json",
      "packages/db/package.json",
      "packages/domain/package.json",
    ])

    expect(check).toEqual({
      missing: ["bun.lock"],
      presentForbidden: ["apps/api/.env", "node_modules/"],
    })
    expect(formatManifestError(check)).toContain("missing: bun.lock")
    expect(formatManifestError(check)).toContain("forbidden: apps/api/.env, node_modules/")
  })
})
