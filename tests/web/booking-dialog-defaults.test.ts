import { describe, expect, it } from "vitest"
import type { Booking } from "../../apps/web/src/lib/api"
import {
  getBookingDialogDefaults,
  getRoundedOneHourRange,
} from "../../apps/web/src/lib/booking-dialog-defaults"

describe("booking dialog defaults", () => {
  it("uses the requested create type for maintenance actions", () => {
    const defaults = getBookingDialogDefaults({
      booking: null,
      initialType: "maintenance",
      initialRange: {
        startsAt: "2026-06-20T10:00:00.000Z",
        endsAt: "2026-06-20T11:00:00.000Z",
      },
    })

    expect(defaults).toMatchObject({
      title: "",
      notes: "",
      type: "maintenance",
      startsDate: "2026-06-20",
      startsTime: "13:00",
      endsDate: "2026-06-20",
      endsTime: "14:00",
    })
  })

  it("keeps the booking type when editing an existing booking", () => {
    const defaults = getBookingDialogDefaults({
      booking: booking("normal"),
      initialType: "maintenance",
    })

    expect(defaults.type).toBe("normal")
    expect(defaults.title).toBe("Training run")
    expect(defaults.notes).toBe("Owner notes")
  })

  it("falls back to a rounded one-hour normal booking", () => {
    const defaults = getBookingDialogDefaults({
      booking: null,
      now: new Date("2026-06-20T10:34:00.000Z"),
    })

    expect(defaults).toMatchObject({
      type: "normal",
      startsDate: "2026-06-20",
      startsTime: "13:00",
      endsDate: "2026-06-20",
      endsTime: "14:00",
    })
  })

  it("rounds explicit action ranges to the current hour", () => {
    expect(getRoundedOneHourRange(new Date("2026-06-20T10:34:12.000Z"))).toEqual({
      startsAt: "2026-06-20T10:00:00.000Z",
      endsAt: "2026-06-20T11:00:00.000Z",
    })
  })
})

function booking(type: Booking["type"]): Booking {
  return {
    id: "booking-1",
    machineId: "machine-1",
    userId: "user-1",
    title: "Training run",
    notes: "Owner notes",
    type,
    startsAt: "2026-06-20T08:00:00.000Z",
    endsAt: "2026-06-20T09:00:00.000Z",
  }
}
