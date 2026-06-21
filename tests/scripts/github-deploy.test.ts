import { describe, expect, it } from "vitest"
import { evaluateGitHubDeployReadiness } from "../../scripts/verify-github-deploy"

const cleanState = {
  branch: "main",
  headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  originUrl: "https://github.com/ardasevinc/lab-management-system.git",
  remoteSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  trackedStatus: "",
}

describe("GitHub deploy readiness", () => {
  it("accepts a clean main branch pushed to GitHub", () => {
    expect(evaluateGitHubDeployReadiness(cleanState)).toEqual({ ok: true, messages: [] })
  })

  it("requires a GitHub origin remote", () => {
    expect(evaluateGitHubDeployReadiness({ ...cleanState, originUrl: "", remoteSha: "" })).toEqual({
      ok: false,
      messages: ["git remote origin is missing", "origin/main is missing or unreachable"],
    })

    expect(
      evaluateGitHubDeployReadiness({
        ...cleanState,
        originUrl: "ssh://git.example.com/miralab/lms.git",
      }),
    ).toEqual({
      ok: false,
      messages: [
        "git remote origin must point at GitHub; got ssh://git.example.com/miralab/lms.git",
      ],
    })
  })

  it("requires local HEAD to be pushed to origin/main", () => {
    expect(
      evaluateGitHubDeployReadiness({
        ...cleanState,
        remoteSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    ).toEqual({
      ok: false,
      messages: ["local HEAD aaaaaaa must be pushed to origin/main bbbbbbb"],
    })
  })

  it("requires the tracked tree on main to be clean", () => {
    expect(
      evaluateGitHubDeployReadiness({
        ...cleanState,
        branch: "deploy-test",
        trackedStatus: " M package.json",
      }),
    ).toEqual({
      ok: false,
      messages: [
        "current branch must be main; got deploy-test",
        "tracked git tree must be clean before GitHub deploy",
      ],
    })
  })
})
