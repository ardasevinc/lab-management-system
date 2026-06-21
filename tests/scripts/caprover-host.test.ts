import { describe, expect, it } from "vitest"
import {
  appContainersCommand,
  engineContainersCommand,
  evaluateAppContainers,
  evaluateEngineContainers,
  parseArgs,
  parseDockerRows,
} from "../../scripts/verify-caprover-host"

describe("CapRover host verifier", () => {
  it("defaults to the MIRALAB host and safe SQLite app cardinality", () => {
    expect(parseArgs([])).toEqual({
      appName: "miralab-lms",
      expectation: "at-most-one",
      host: "meruem",
    })
  })

  it("parses host, app, and expectation overrides", () => {
    expect(
      parseArgs(["--host", "deploy-1", "--app", "miralab-lms-staging", "--expect", "running"]),
    ).toEqual({
      appName: "miralab-lms-staging",
      expectation: "running",
      host: "deploy-1",
    })
  })

  it("rejects unsafe identifiers before composing ssh commands", () => {
    expect(() => parseArgs(["--host", "meruem;reboot"])).toThrow("host contains unsafe characters")
    expect(() => parseArgs(["--app", "miralab-lms $(whoami)"])).toThrow(
      "app contains unsafe characters",
    )
  })

  it("parses docker rows without keeping blank output", () => {
    expect(
      parseDockerRows(
        [
          "captain-captain.1.abc\tUp 2 days",
          "",
          "srv-captain--miralab-lms.1.def\tUp 5 minutes (healthy)",
        ].join("\n"),
      ),
    ).toEqual([
      { name: "captain-captain.1.abc", status: "Up 2 days" },
      { name: "srv-captain--miralab-lms.1.def", status: "Up 5 minutes (healthy)" },
    ])
  })

  it("requires captain and nginx engine containers", () => {
    expect(
      evaluateEngineContainers([
        { name: "captain-captain.1.abc", status: "Up 2 days" },
        { name: "captain-nginx.1.def", status: "Up 2 days" },
      ]),
    ).toEqual({ ok: true, message: "CapRover engine containers are running" })

    expect(
      evaluateEngineContainers([{ name: "captain-captain.1.abc", status: "Up 2 days" }]),
    ).toEqual({
      ok: false,
      message: "CapRover nginx container is not running",
    })
  })

  it("allows zero or one app container by default and rejects duplicates", () => {
    const options = parseArgs([])

    expect(evaluateAppContainers([], options)).toEqual({
      ok: true,
      message: "miralab-lms container cardinality matches at-most-one",
    })
    expect(
      evaluateAppContainers(
        [{ name: "srv-captain--miralab-lms.1.abc", status: "Up 1 minute" }],
        options,
      ),
    ).toEqual({ ok: true, message: "miralab-lms container cardinality matches at-most-one" })
    expect(
      evaluateAppContainers(
        [
          { name: "srv-captain--miralab-lms.1.abc", status: "Up 1 minute" },
          { name: "srv-captain--miralab-lms.2.def", status: "Up 1 minute" },
        ],
        options,
      ),
    ).toEqual({
      ok: false,
      message: "miralab-lms has 2 running containers; SQLite MVP requires exactly one",
    })
  })

  it("supports absent and running expectations for deployment phases", () => {
    expect(
      evaluateAppContainers([{ name: "srv-captain--miralab-lms.1.abc", status: "Up 1 minute" }], {
        ...parseArgs([]),
        expectation: "absent",
      }),
    ).toEqual({ ok: false, message: "miralab-lms already has a running app container" })

    expect(evaluateAppContainers([], { ...parseArgs([]), expectation: "running" })).toEqual({
      ok: false,
      message: "miralab-lms does not have one healthy running container",
    })
  })

  it("pins the docker commands used over ssh", () => {
    expect(engineContainersCommand()).toBe(
      "docker ps --filter 'name=^/captain-(captain|nginx)\\.' --format '{{.Names}}\\t{{.Status}}'",
    )
    expect(appContainersCommand("miralab-lms")).toBe(
      "docker ps --filter 'name=^/srv-captain--miralab-lms\\.' --format '{{.Names}}\\t{{.Status}}'",
    )
  })
})
