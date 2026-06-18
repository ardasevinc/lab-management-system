import { describe, expect, it } from "vitest"
import {
  fromLocalDateTimeParts,
  toLocalDateValue,
  toLocalTimeValue,
} from "../../apps/web/src/lib/time"

describe("time helpers", () => {
  it("round-trips local date and time fields", () => {
    const iso = fromLocalDateTimeParts("2026-06-18", "15:30")

    expect(toLocalDateValue(iso)).toBe("2026-06-18")
    expect(toLocalTimeValue(iso)).toBe("15:30")
  })
})
