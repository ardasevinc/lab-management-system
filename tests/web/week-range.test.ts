import { describe, expect, it } from "vitest"
import { toLocalDateValue } from "../../apps/web/src/lib/time"
import { getWeekRange } from "../../apps/web/src/lib/week-range"

describe("week range", () => {
  it("starts weeks on Monday and uses an exclusive next-Monday end", () => {
    const range = getWeekRange(new Date(2026, 5, 18, 13))

    expect(toLocalDateValue(range.start)).toBe("2026-06-15")
    expect(toLocalDateValue(range.end)).toBe("2026-06-22")
  })
})
