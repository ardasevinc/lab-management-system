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
  { label: "verify:caprover-dns", command: ["bun", "run", "verify:caprover-dns"] },
  {
    label: "verify:caprover-host",
    command: ["bun", "run", "verify:caprover-host", "--expect", "absent"],
  },
]

export function summarizePreflight(results: PreflightResult[]) {
  const failed = results.filter((result) => !result.ok)

  if (failed.length > 0) {
    return {
      ok: false,
      message: `CapRover preflight failed: ${failed.map((result) => result.step.label).join(", ")}`,
    }
  }

  return {
    ok: true,
    message: "verified CapRover preflight",
  }
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
