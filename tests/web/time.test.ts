import { describe, expect, it } from "vitest"
import {
  formatDate,
  formatDateTime,
  formatTime,
  fromLabDateTimeParts,
  toLabDateValue,
  toLabTimeValue,
} from "../../apps/web/src/lib/time"

describe("time helpers", () => {
  it("round-trips lab date and time fields", () => {
    const iso = fromLabDateTimeParts("2026-06-18", "15:30")

    expect(iso).toBe("2026-06-18T12:30:00.000Z")
    expect(toLabDateValue(iso)).toBe("2026-06-18")
    expect(toLabTimeValue(iso)).toBe("15:30")
  })

  it("formats visible booking times in the lab timezone", () => {
    const iso = "2026-05-10T10:10:00.000Z"

    expect(formatTime(iso)).toBe("13:10")
    expect(formatDate(iso)).toBe("Sun, May 10")
    expect(formatDateTime(iso)).toBe("Sun, May 10 13:10 Europe/Istanbul")
  })
})
