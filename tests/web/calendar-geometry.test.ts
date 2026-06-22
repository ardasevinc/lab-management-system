import { describe, expect, it } from "vitest"
import type { Booking } from "../../apps/web/src/lib/api"
import {
  bookingStyle,
  bookingsForDay,
  buildWeekDays,
  dateAtMinutes,
  defaultRangeAtMinutes,
  hasConflict,
  hourHeightPx,
  minutesSinceDayStart,
  moveRangeToDayAndMinutes,
  normalizeRange,
  packOverlaps,
  resizeRangeEnd,
  resizeRangeStart,
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

  it("normalizes upward drag-create ranges", () => {
    const range = normalizeRange(day, 14 * 60 + 10, 10 * 60 + 40)

    expect(range).toEqual({
      startsAt: iso(10 * 60 + 30),
      endsAt: iso(14 * 60),
    })
  })

  it("keeps drag-create ranges inside the visible day", () => {
    const range = normalizeRange(day, 7 * 60 + 30, 23 * 60)

    expect(range).toEqual({
      startsAt: iso(7 * 60 + 30),
      endsAt: iso(23 * 60),
    })
  })

  it("creates a one-hour default range for click bookings", () => {
    const range = defaultRangeAtMinutes(day, 10 * 60 + 10)

    expect(range).toEqual({
      startsAt: iso(10 * 60),
      endsAt: iso(11 * 60),
    })
  })

  it("keeps default click bookings inside the visible day", () => {
    const range = defaultRangeAtMinutes(day, 21 * 60 + 50)

    expect(range).toEqual({
      startsAt: iso(22 * 60),
      endsAt: iso(23 * 60),
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

  it("moves ranges across lab days while preserving duration", () => {
    const nextDay = buildWeekDays(day)[1]
    const range = moveRangeToDayAndMinutes(
      {
        startsAt: iso(10 * 60),
        endsAt: iso(12 * 60),
      },
      nextDay,
      13 * 60,
    )

    expect(range).toEqual({
      startsAt: dateAtMinutes(nextDay, 13 * 60).toISOString(),
      endsAt: dateAtMinutes(nextDay, 15 * 60).toISOString(),
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

  it("resizes the start with minimum duration", () => {
    const range = resizeRangeStart(
      {
        startsAt: iso(10 * 60),
        endsAt: iso(12 * 60),
      },
      11 * 60 + 55,
    )

    expect(range.startsAt).toBe(iso(11 * 60 + 30))
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

  it("keeps adjacent bookings full width", () => {
    const packed = packOverlaps([
      booking("a", iso(9 * 60), iso(10 * 60)),
      booking("b", iso(10 * 60), iso(11 * 60)),
      booking("c", iso(11 * 60), iso(12 * 60)),
    ])

    expect(
      packed.map((item) => ({ id: item.id, column: item.column, columnCount: item.columnCount })),
    ).toEqual([
      { id: "a", column: 0, columnCount: 1 },
      { id: "b", column: 0, columnCount: 1 },
      { id: "c", column: 0, columnCount: 1 },
    ])
  })

  it("does not leak packed widths across disjoint overlap clusters", () => {
    const packed = packOverlaps([
      booking("morning-a", iso(9 * 60), iso(10 * 60)),
      booking("morning-b", iso(9 * 60 + 30), iso(10 * 60 + 30)),
      booking("midday", iso(10 * 60 + 30), iso(11 * 60 + 30)),
      booking("afternoon-a", iso(12 * 60), iso(13 * 60)),
      booking("afternoon-b", iso(12 * 60 + 30), iso(13 * 60 + 30)),
      booking("afternoon-c", iso(12 * 60 + 45), iso(13 * 60 + 15)),
    ])

    expect(
      packed.map((item) => ({ id: item.id, column: item.column, columnCount: item.columnCount })),
    ).toEqual([
      { id: "morning-a", column: 0, columnCount: 2 },
      { id: "morning-b", column: 1, columnCount: 2 },
      { id: "midday", column: 0, columnCount: 1 },
      { id: "afternoon-a", column: 0, columnCount: 3 },
      { id: "afternoon-b", column: 1, columnCount: 3 },
      { id: "afternoon-c", column: 2, columnCount: 3 },
    ])
  })

  it("keeps long bridge bookings as wide as the densest active cluster they overlap", () => {
    const packed = packOverlaps([
      booking("bridge", iso(9 * 60), iso(13 * 60)),
      booking("short-a", iso(10 * 60), iso(11 * 60)),
      booking("short-b", iso(10 * 60 + 30), iso(11 * 60 + 30)),
      booking("tail", iso(12 * 60), iso(13 * 60)),
    ])

    expect(
      packed.map((item) => ({ id: item.id, column: item.column, columnCount: item.columnCount })),
    ).toEqual([
      { id: "bridge", column: 0, columnCount: 3 },
      { id: "short-a", column: 1, columnCount: 3 },
      { id: "short-b", column: 2, columnCount: 3 },
      { id: "tail", column: 1, columnCount: 2 },
    ])
  })

  it("creates slot dates in the lab timezone", () => {
    expect(dateAtMinutes(day, 10 * 60).toISOString()).toBe("2026-05-11T07:00:00.000Z")
  })

  it("buckets UTC late-night bookings by lab day", () => {
    const lateNightBooking = booking("late", "2026-05-10T21:30:00.000Z", "2026-05-10T22:30:00.000Z")
    const sunday = new Date("2026-05-10T12:00:00.000Z")
    const monday = new Date("2026-05-11T12:00:00.000Z")

    expect(bookingsForDay([lateNightBooking], sunday)).toEqual([])
    expect(bookingsForDay([lateNightBooking], monday)).toEqual([lateNightBooking])
  })

  it("places bookings by lab-time minutes", () => {
    const [packed] = packOverlaps([
      booking("late", "2026-05-10T21:30:00.000Z", "2026-05-10T22:30:00.000Z"),
    ])

    expect(minutesSinceDayStart(new Date(packed.startsAt))).toBe(30)
    expect(bookingStyle(packed)).toEqual({
      top: (30 / 60) * hourHeightPx,
      height: hourHeightPx,
      left: 0,
      width: 100,
    })
  })

  it("builds week days from lab week boundaries", () => {
    expect(
      buildWeekDays(new Date("2026-05-10T21:30:00.000Z")).map((date) => date.toISOString()),
    ).toEqual([
      "2026-05-10T21:00:00.000Z",
      "2026-05-11T21:00:00.000Z",
      "2026-05-12T21:00:00.000Z",
      "2026-05-13T21:00:00.000Z",
      "2026-05-14T21:00:00.000Z",
      "2026-05-15T21:00:00.000Z",
      "2026-05-16T21:00:00.000Z",
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
