export type PreflightStep = {
  label: string
  command: string[]
}

export type PreflightResult = {
  step: PreflightStep
  ok: boolean
  status: number | null
}

export const PREFLIGHT_STEPS: PreflightStep[] = [
  { label: "pack:caprover", command: ["bun", "run", "pack:caprover"] },
  { label: "verify:caprover-env", command: ["bun", "run", "verify:caprover-env"] },
  { label: "verify:caprover-package", command: ["bun", "run", "verify:caprover-package"] },
  { label: "verify:email-dns", command: ["bun", "run", "verify:email-dns"] },
  { label: "verify:caprover-dns", command: ["bun", "run", "verify:caprover-dns"] },
  {
    label: "verify:caprover-host",
    command: ["bun", "run", "verify:caprover-host", "--expect", "absent"],
  },
]

export function summarizePreflight(results: PreflightResult[]) {
  const failed = results.filter((result) => !result.ok)

  if (failed.length > 0) {
    const hints = preflightFailureHints(failed.map((result) => result.step.label))
    const hintText = hints.length > 0 ? `\n\nNext steps:\n${hints.join("\n")}` : ""

    return {
      ok: false,
      message: `CapRover preflight failed: ${failed.map((result) => result.step.label).join(", ")}${hintText}`,
    }
  }

  return {
    ok: true,
    message: "verified CapRover preflight",
  }
}

export function preflightFailureHints(labels: string[]) {
  const hints: string[] = []
  const failed = new Set(labels)

  if (failed.has("verify:caprover-dns")) {
    hints.push(
      "- Fix app DNS: add pa item cloudflare/miralab/dns-edit-token or set CLOUDFLARE_API_TOKEN, then run bun run setup:cloudflare-dns && bun run verify:caprover-dns.",
    )
  }

  if (failed.has("verify:caprover-host")) {
    hints.push(
      "- Check CapRover host state: ssh meruem, verify captain-captain/captain-nginx are running, and make sure miralab-lms is absent before first app creation.",
    )
  }

  if (failed.has("verify:email-dns")) {
    hints.push(
      "- Fix SES DNS: rerun bun run verify:email-dns and update DMARC/custom MAIL FROM records until it passes.",
    )
  }

  if (failed.has("verify:caprover-env")) {
    hints.push(
      "- Fix deploy/caprover.env.example or the generated env contract, then rerun bun run verify:caprover-env.",
    )
  }

  if (failed.has("verify:caprover-package") || failed.has("pack:caprover")) {
    hints.push(
      "- Fix packaging: commit any tracked changes first; if the tree is clean, fix the CapRover package/build metadata and rerun bun run pack:caprover.",
    )
  }

  return hints
}

function runStep(step: PreflightStep): PreflightResult {
  console.log(`\n==> ${step.label}`)

  const result = Bun.spawnSync({
    cmd: step.command,
    stderr: "pipe",
    stdout: "pipe",
  })

  const stdout = result.stdout.toString()
  const stderr = result.stderr.toString()

  if (stdout) {
    process.stdout.write(stdout)
  }

  if (stderr) {
    process.stderr.write(stderr)
  }

  const ok = result.success
  console.log(`${ok ? "✓" : "✗"} ${step.label}`)

  return {
    step,
    ok,
    status: result.exitCode,
  }
}

function runPreflight() {
  const results = PREFLIGHT_STEPS.map(runStep)
  const summary = summarizePreflight(results)
  const log = summary.ok ? console.log : console.error

  log(`\n${summary.message}`)

  if (!summary.ok) {
    process.exit(1)
  }
}

if (import.meta.main) {
  runPreflight()
}
