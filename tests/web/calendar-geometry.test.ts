import { describe, expect, it } from "vitest"
import type { Booking } from "../../apps/web/src/lib/api"
import {
  dateAtMinutes,
  hasConflict,
  moveRangeToDayAndMinutes,
  normalizeRange,
  packOverlaps,
  resizeRangeEnd,
  snapMinutes,
} from "../../apps/web/src/lib/calendar-geometry"

const day = new Date(2026, 4, 11)

describe("calendar geometry", () => {
  it("snaps minutes to the nearest configured step", () => {
    expect(snapMinutes(608)).toBe(600)
    expect(snapMinutes(616)).toBe(630)
  })

  it("normalizes drag ranges with a minimum duration", () => {
    const range = normalizeRange(day, 10 * 60 + 10, 10 * 60 + 20)

    expect(range).toEqual({
      startsAt: iso(10 * 60),
      endsAt: iso(10 * 60 + 30),
    })
  })

  it("moves ranges while preserving duration", () => {
    const range = moveRangeToDayAndMinutes(
      {
        startsAt: iso(10 * 60),
        endsAt: iso(12 * 60),
      },
      day,
      13 * 60 + 10,
    )

    expect(range).toEqual({
      startsAt: iso(13 * 60),
      endsAt: iso(15 * 60),
    })
  })

  it("resizes the end with minimum duration", () => {
    const range = resizeRangeEnd(
      {
        startsAt: iso(10 * 60),
        endsAt: iso(12 * 60),
      },
      10 * 60 + 5,
    )

    expect(range.endsAt).toBe(iso(10 * 60 + 30))
  })

  it("detects overlaps while allowing adjacent ranges", () => {
    const bookings: Booking[] = [booking("a", iso(10 * 60), iso(12 * 60))]

    expect(hasConflict({ startsAt: iso(11 * 60), endsAt: iso(12 * 60 + 30) }, bookings)).toBe(true)
    expect(hasConflict({ startsAt: iso(12 * 60), endsAt: iso(12 * 60 + 30) }, bookings)).toBe(false)
  })

  it("packs overlapping bookings into columns", () => {
    const packed = packOverlaps([
      booking("a", iso(10 * 60), iso(12 * 60)),
      booking("b", iso(11 * 60), iso(13 * 60)),
      booking("c", iso(13 * 60), iso(14 * 60)),
    ])

    expect(
      packed.map((item) => ({ id: item.id, column: item.column, columnCount: item.columnCount })),
    ).toEqual([
      { id: "a", column: 0, columnCount: 2 },
      { id: "b", column: 1, columnCount: 2 },
      { id: "c", column: 0, columnCount: 1 },
    ])
  })
})

function booking(id: string, startsAt: string, endsAt: string): Booking {
  return {
    id,
    startsAt,
    endsAt,
    machineId: "tohum",
    userId: "member-local",
    title: id,
    notes: null,
    type: "normal",
  }
}

function iso(minutes: number) {
  return dateAtMinutes(day, minutes).toISOString()
}
