import { describe, expect, it } from "vitest"
import {
  PREFLIGHT_STEPS,
  preflightFailureHints,
  summarizePreflight,
} from "../../scripts/verify-caprover-preflight"

describe("CapRover preflight orchestrator", () => {
  it("runs the deployment preflight steps in runbook order", () => {
    expect(PREFLIGHT_STEPS).toEqual([
      { label: "pack:caprover", command: ["bun", "run", "pack:caprover"] },
      { label: "verify:caprover-env", command: ["bun", "run", "verify:caprover-env"] },
      {
        label: "verify:caprover-package",
        command: ["bun", "run", "verify:caprover-package"],
      },
      { label: "verify:email-dns", command: ["bun", "run", "verify:email-dns"] },
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
      ok: index !== 1 && index !== 4,
      status: index !== 1 && index !== 4 ? 0 : 1,
    }))

    expect(summarizePreflight(results)).toEqual({
      ok: false,
      message: [
        "CapRover preflight failed: verify:caprover-env, verify:caprover-dns",
        "",
        "Next steps:",
        "- Fix app DNS: add pa item cloudflare/miralab/dns-edit-token or set CLOUDFLARE_API_TOKEN, then run bun run setup:cloudflare-dns && bun run verify:caprover-dns.",
        "- Fix deploy/caprover.env.example or the generated env contract, then rerun bun run verify:caprover-env.",
      ].join("\n"),
    })
  })

  it("prints actionable hints for known deploy blockers", () => {
    expect(
      preflightFailureHints([
        "verify:caprover-dns",
        "verify:caprover-host",
        "verify:email-dns",
        "verify:caprover-package",
        "pack:caprover",
      ]),
    ).toEqual([
      "- Fix app DNS: add pa item cloudflare/miralab/dns-edit-token or set CLOUDFLARE_API_TOKEN, then run bun run setup:cloudflare-dns && bun run verify:caprover-dns.",
      "- Check CapRover host state: ssh meruem, verify captain-captain/captain-nginx are running, and make sure miralab-lms is absent before first app creation.",
      "- Fix SES DNS: rerun bun run verify:email-dns and update DMARC/custom MAIL FROM records until it passes.",
      "- Fix packaging: commit any tracked changes first; if the tree is clean, fix the CapRover package/build metadata and rerun bun run pack:caprover.",
    ])
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
