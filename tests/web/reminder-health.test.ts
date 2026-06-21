import { describe, expect, it } from "vitest"
import type { ApiHealth } from "../../apps/web/src/lib/api"
import { getReminderHealthDisplay } from "../../apps/web/src/lib/reminder-health"

const baseHealth: ApiHealth = {
  ok: true,
  service: "lab-api",
  lab: "MIRALAB",
  checks: {
    database: "ok",
    machines: 1,
    reminders: {
      enabled: true,
      intervalSeconds: 60,
      startReminderMinutes: 15,
      endingReminderMinutes: 15,
      retryDelayMinutes: 5,
      maxAttempts: 3,
    },
  },
}

describe("reminder health display", () => {
  it("summarizes enabled reminder windows", () => {
    expect(getReminderHealthDisplay({ health: baseHealth })).toEqual({
      value: "Enabled",
      detail: "Start 15m, end 15m, retry 3x",
      badge: "normal",
    })
  })

  it("surfaces disabled reminders as an admin-visible operation state", () => {
    expect(
      getReminderHealthDisplay({
        health: {
          ...baseHealth,
          checks: {
            ...baseHealth.checks,
            reminders: { ...baseHealth.checks.reminders, enabled: false },
          },
        },
      }),
    ).toEqual({
      value: "Disabled",
      detail: "Start/end reminders off",
      badge: "off",
    })
  })

  it("keeps health fetch failures visible without crashing the overview", () => {
    expect(getReminderHealthDisplay({ isError: true })).toEqual({
      value: "Unknown",
      detail: "Health check unavailable",
      badge: "check",
    })
  })
})
