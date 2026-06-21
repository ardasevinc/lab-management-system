import { describe, expect, it } from "vitest"
import { PREFLIGHT_STEPS, summarizePreflight } from "../../scripts/verify-caprover-preflight"

describe("CapRover preflight orchestrator", () => {
  it("runs the deployment preflight steps in runbook order", () => {
    expect(PREFLIGHT_STEPS).toEqual([
      { label: "pack:caprover", command: ["bun", "run", "pack:caprover"] },
      { label: "verify:caprover-env", command: ["bun", "run", "verify:caprover-env"] },
      {
        label: "verify:caprover-package",
        command: ["bun", "run", "verify:caprover-package"],
      },
      { label: "verify:caprover-dns", command: ["bun", "run", "verify:caprover-dns"] },
      {
        label: "verify:caprover-host",
        command: ["bun", "run", "verify:caprover-host", "--expect", "absent"],
      },
    ])
  })

  it("reports every failed preflight step instead of only the first one", () => {
    const results = PREFLIGHT_STEPS.map((step, index) => ({
      step,
      ok: index !== 1 && index !== 3,
      status: index !== 1 && index !== 3 ? 0 : 1,
    }))

    expect(summarizePreflight(results)).toEqual({
      ok: false,
      message: "CapRover preflight failed: verify:caprover-env, verify:caprover-dns",
    })
  })

  it("returns a passing summary when all steps pass", () => {
    const results = PREFLIGHT_STEPS.map((step) => ({
      step,
      ok: true,
      status: 0,
    }))

    expect(summarizePreflight(results)).toEqual({
      ok: true,
      message: "verified CapRover preflight",
    })
  })
})
