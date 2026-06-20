import { describe, expect, it } from "vitest"
import { toLabDateValue } from "../../apps/web/src/lib/time"
import { getWeekRange } from "../../apps/web/src/lib/week-range"

describe("week range", () => {
  it("starts weeks on Monday and uses an exclusive next-Monday end", () => {
    const range = getWeekRange(new Date(2026, 5, 18, 13))

    expect(range.start).toBe("2026-06-14T21:00:00.000Z")
    expect(range.end).toBe("2026-06-21T21:00:00.000Z")
    expect(toLabDateValue(range.start)).toBe("2026-06-15")
    expect(toLabDateValue(range.end)).toBe("2026-06-22")
  })

  it("maps weekend date picks to their containing week", () => {
    const range = getWeekRange(new Date(2026, 5, 21, 18))

    expect(toLabDateValue(range.start)).toBe("2026-06-15")
    expect(toLabDateValue(range.end)).toBe("2026-06-22")
  })

  it("maps late UTC instants by their lab week", () => {
    const range = getWeekRange(new Date("2026-05-10T21:30:00.000Z"))

    expect(range.start).toBe("2026-05-10T21:00:00.000Z")
    expect(range.end).toBe("2026-05-17T21:00:00.000Z")
    expect(toLabDateValue(range.start)).toBe("2026-05-11")
    expect(toLabDateValue(range.end)).toBe("2026-05-18")
  })
})
