import { spawnSync } from "node:child_process"

type GitHubDeployState = {
  branch: string
  headSha: string
  originUrl: string
  remoteSha: string
  trackedStatus: string
}

type ReadinessResult = {
  ok: boolean
  messages: string[]
}

const expectedBranch = "main"

export function evaluateGitHubDeployReadiness(state: GitHubDeployState): ReadinessResult {
  const messages: string[] = []

  if (state.branch !== expectedBranch) {
    messages.push(`current branch must be ${expectedBranch}; got ${state.branch || "<none>"}`)
  }

  if (state.trackedStatus.trim()) {
    messages.push("tracked git tree must be clean before GitHub deploy")
  }

  if (!state.originUrl) {
    messages.push("git remote origin is missing")
  } else if (!isGitHubRemote(state.originUrl)) {
    messages.push(`git remote origin must point at GitHub; got ${state.originUrl}`)
  }

  if (!state.remoteSha) {
    messages.push(`origin/${expectedBranch} is missing or unreachable`)
  } else if (state.headSha !== state.remoteSha) {
    messages.push(
      `local HEAD ${state.headSha.slice(0, 7)} must be pushed to origin/${expectedBranch} ${state.remoteSha.slice(0, 7)}`,
    )
  }

  return {
    ok: messages.length === 0,
    messages,
  }
}

function isGitHubRemote(value: string) {
  return /(^git@github\.com:|^https:\/\/github\.com\/)/.test(value)
}

function git(args: string[], options: { optional?: boolean } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" })

  if (result.status !== 0 && !options.optional) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`)
  }

  return result.stdout.trim()
}

function run(args: string[]) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", stdio: "pipe" })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }

  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  if (result.status !== 0) {
    throw new Error(`${args.join(" ")} failed`)
  }
}

function collectState(): GitHubDeployState {
  const branch = git(["branch", "--show-current"])
  const originUrl = git(["config", "--get", "remote.origin.url"], { optional: true })

  return {
    branch,
    headSha: git(["rev-parse", "HEAD"]),
    originUrl,
    remoteSha: originUrl
      ? git(["ls-remote", "origin", `refs/heads/${expectedBranch}`], { optional: true }).split(
          /\s+/,
        )[0] || ""
      : "",
    trackedStatus: git(["status", "--porcelain", "--untracked-files=no"]),
  }
}

function main() {
  const result = evaluateGitHubDeployReadiness(collectState())

  if (!result.ok) {
    console.error(
      `GitHub deploy readiness failed:\n${result.messages.map((message) => `- ${message}`).join("\n")}`,
    )
    process.exit(1)
  }

  run(["bun", "scripts/verify-caprover-package.ts"])
  run(["bun", "scripts/verify-caprover-env.ts"])

  console.log("verified GitHub deploy readiness")
}

if (import.meta.main) {
  main()
}
