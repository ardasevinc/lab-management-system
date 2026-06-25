import { describe, expect, it } from "vitest"
import { dayAgendaDefaultRange } from "../../apps/web/src/lib/schedule-defaults"

describe("schedule defaults", () => {
  it("uses the selected agenda day for mobile quick booking", () => {
    const range = dayAgendaDefaultRange(
      new Date("2026-06-23T00:00:00.000Z"),
      new Date("2026-06-20T10:34:00.000Z"),
    )

    expect(range).toEqual({
      startsAt: "2026-06-23T05:00:00.000Z",
      endsAt: "2026-06-23T06:00:00.000Z",
    })
  })

  it("uses the next rounded slot when the selected agenda day is today", () => {
    const range = dayAgendaDefaultRange(
      new Date("2026-06-20T00:00:00.000Z"),
      new Date("2026-06-20T10:34:00.000Z"),
    )

    expect(range).toEqual({
      startsAt: "2026-06-20T11:00:00.000Z",
      endsAt: "2026-06-20T12:00:00.000Z",
    })
  })
})
