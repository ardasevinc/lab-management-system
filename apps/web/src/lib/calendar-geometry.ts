import { differenceInMinutes } from "date-fns"
import type { Booking } from "./api"
import {
  addLabDays,
  fromLabDateTimeParts,
  startOfLabWeek,
  toLabDateValue,
  toLabTimeValue,
} from "./time"

export type CalendarRange = {
  startsAt: string
  endsAt: string
}

export type PackedBooking = Booking & {
  displayStartsAt?: string
  displayEndsAt?: string
  startsBeforeDay?: boolean
  endsAfterDay?: boolean
  column: number
  columnCount: number
}

export const dayStartHour = 0
export const dayEndHour = 24
export const defaultVisibleStartHour = 8
export const defaultBookingStartHour = 8
export const snapStepMinutes = 30
export const defaultBookingDurationMinutes = 60
export const hourHeightPx = 56

export function startOfWeek(date: Date) {
  return new Date(fromLabDateTimeParts(startOfLabWeek(date), "00:00"))
}

export function buildWeekDays(date: Date) {
  const start = startOfLabWeek(date)
  return Array.from(
    { length: 7 },
    (_, index) => new Date(fromLabDateTimeParts(addLabDays(start, index), "00:00")),
  )
}

export function minutesSinceDayStart(date: Date) {
  const [hours, minutes] = toLabTimeValue(date).split(":").map(Number)
  return hours * 60 + minutes
}

export function minutesToY(minutes: number) {
  return ((minutes - dayStartHour * 60) / 60) * hourHeightPx
}

export function yToMinutes(y: number) {
  return dayStartHour * 60 + (y / hourHeightPx) * 60
}

export function snapMinutes(minutes: number, step = snapStepMinutes) {
  return Math.round(minutes / step) * step
}

export function snapMinutesUp(minutes: number, step = snapStepMinutes) {
  return Math.ceil(minutes / step) * step
}

export function clampMinutesToDay(minutes: number) {
  return Math.min(dayEndHour * 60, Math.max(dayStartHour * 60, minutes))
}

export function dateAtMinutes(day: Date, minutes: number) {
  const clampedMinutes = Math.max(0, Math.min(24 * 60, Math.round(minutes)))
  const hours = Math.floor(clampedMinutes / 60)
  const remainingMinutes = clampedMinutes % 60
  return new Date(fromLabDateTimeParts(toLabDateValue(day), timeValue(hours, remainingMinutes)))
}

export function normalizeRange(day: Date, startMinutes: number, endMinutes: number) {
  const snappedStart = clampMinutesToDay(snapMinutes(Math.min(startMinutes, endMinutes)))
  const snappedEnd = clampMinutesToDay(snapMinutes(Math.max(startMinutes, endMinutes)))
  const minimumEnd = Math.min(dayEndHour * 60, snappedStart + snapStepMinutes)
  const endsAt = Math.max(snappedEnd, minimumEnd)

  return {
    startsAt: dateAtMinutes(day, snappedStart).toISOString(),
    endsAt: dateAtMinutes(day, endsAt).toISOString(),
  }
}

export function defaultRangeAtMinutes(
  day: Date,
  startMinutes: number,
  durationMinutes = defaultBookingDurationMinutes,
) {
  const duration = Math.max(snapStepMinutes, durationMinutes)
  const snappedStart = clampMinutesToDay(snapMinutes(startMinutes))
  const latestStart = dayEndHour * 60 - duration
  const clampedStart = Math.min(Math.max(dayStartHour * 60, snappedStart), latestStart)

  return {
    startsAt: dateAtMinutes(day, clampedStart).toISOString(),
    endsAt: dateAtMinutes(day, clampedStart + duration).toISOString(),
  }
}

export function moveRangeToDayAndMinutes(range: CalendarRange, day: Date, startMinutes: number) {
  const start = new Date(range.startsAt)
  const end = new Date(range.endsAt)
  const duration = Math.max(snapStepMinutes, differenceInMinutes(end, start))
  const snappedStart = clampMinutesToDay(snapMinutes(startMinutes))
  const latestStart = dayEndHour * 60 - duration
  const clampedStart = Math.min(Math.max(dayStartHour * 60, snappedStart), latestStart)

  return {
    startsAt: dateAtMinutes(day, clampedStart).toISOString(),
    endsAt: dateAtMinutes(day, clampedStart + duration).toISOString(),
  }
}

export function resizeRangeEnd(range: CalendarRange, endMinutes: number) {
  const start = new Date(range.startsAt)
  const startMinutes = minutesSinceDayStart(start)
  const snappedEnd = clampMinutesToDay(snapMinutes(endMinutes))
  const minimumEnd = startMinutes + snapStepMinutes

  return {
    startsAt: range.startsAt,
    endsAt: dateAtMinutes(start, Math.max(snappedEnd, minimumEnd)).toISOString(),
  }
}

export function resizeRangeStart(range: CalendarRange, startMinutes: number) {
  const end = new Date(range.endsAt)
  const endMinutes = minutesSinceDayStart(end)
  const snappedStart = clampMinutesToDay(snapMinutes(startMinutes))
  const maximumStart = endMinutes - snapStepMinutes

  return {
    startsAt: dateAtMinutes(end, Math.min(snappedStart, maximumStart)).toISOString(),
    endsAt: range.endsAt,
  }
}

export function rangesOverlap(a: CalendarRange, b: CalendarRange) {
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(a.endsAt) > new Date(b.startsAt)
}

export function hasConflict(range: CalendarRange, bookings: Booking[], excludeBookingId?: string) {
  return bookings.some(
    (booking) =>
      booking.id !== excludeBookingId &&
      rangesOverlap(range, { startsAt: booking.startsAt, endsAt: booking.endsAt }),
  )
}

export function bookingsForDay(bookings: Booking[], day: Date) {
  const dayRange = dayBounds(day)

  return bookings
    .filter((booking) => rangesOverlap(booking, dayRange))
    .map((booking) => {
      const startsAt = new Date(booking.startsAt)
      const endsAt = new Date(booking.endsAt)
      const dayStartsAt = new Date(dayRange.startsAt)
      const dayEndsAt = new Date(dayRange.endsAt)

      return {
        ...booking,
        displayStartsAt: startsAt > dayStartsAt ? booking.startsAt : dayRange.startsAt,
        displayEndsAt: endsAt < dayEndsAt ? booking.endsAt : dayRange.endsAt,
        startsBeforeDay: startsAt < dayStartsAt,
        endsAfterDay: endsAt > dayEndsAt,
      }
    })
}

export function packOverlaps<T extends Booking>(bookings: T[]): Array<T & PackedBooking> {
  const sorted = [...bookings].sort(
    (a, b) => new Date(displayStartsAt(a)).getTime() - new Date(displayStartsAt(b)).getTime(),
  )
  const active: Array<T & PackedBooking> = []
  const packed: Array<T & PackedBooking> = []

  for (const booking of sorted) {
    const startsAt = new Date(displayStartsAt(booking))
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (new Date(displayEndsAt(active[index])) <= startsAt) {
        active.splice(index, 1)
      }
    }

    const usedColumns = new Set(active.map((item) => item.column))
    let column = 0
    while (usedColumns.has(column)) {
      column += 1
    }

    const packedBooking: T & PackedBooking = {
      ...booking,
      column,
      columnCount: Math.max(1, active.length + 1),
    }
    active.push(packedBooking)

    for (const item of active) {
      item.columnCount = Math.max(item.columnCount, active.length)
    }

    packed.push(packedBooking)
  }

  return packed
}

export function bookingStyle(booking: PackedBooking) {
  const start = new Date(displayStartsAt(booking))
  const end = new Date(displayEndsAt(booking))
  const startMinutes = minutesSinceDayStart(start)
  const endMinutes =
    toLabDateValue(end) === toLabDateValue(start) ? minutesSinceDayStart(end) : dayEndHour * 60
  const top = minutesToY(startMinutes)
  const height = Math.max(24, minutesToY(endMinutes) - top)
  const width = 100 / booking.columnCount
  const left = booking.column * width

  return {
    top,
    height,
    left,
    width,
  }
}

export function displayStartsAt(booking: CalendarRange & { displayStartsAt?: string }) {
  return booking.displayStartsAt ?? booking.startsAt
}

export function displayEndsAt(booking: CalendarRange & { displayEndsAt?: string }) {
  return booking.displayEndsAt ?? booking.endsAt
}

export function displayStartTimeValue(
  booking: CalendarRange & { displayStartsAt?: string; startsBeforeDay?: boolean },
) {
  return booking.startsBeforeDay ? "00:00" : toLabTimeValue(displayStartsAt(booking))
}

export function displayEndTimeValue(
  booking: CalendarRange & { displayEndsAt?: string; endsAfterDay?: boolean },
) {
  return booking.endsAfterDay ? "24:00" : toLabTimeValue(displayEndsAt(booking))
}

function dayBounds(day: Date): CalendarRange {
  return {
    startsAt: dateAtMinutes(day, dayStartHour * 60).toISOString(),
    endsAt: dateAtMinutes(day, dayEndHour * 60).toISOString(),
  }
}

function timeValue(hours: number, minutes: number) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}
