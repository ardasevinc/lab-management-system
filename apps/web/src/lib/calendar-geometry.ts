import {
  addDays,
  addMinutes,
  startOfWeek as dateFnsStartOfWeek,
  differenceInMinutes,
  isSameDay,
  setHours,
  setMinutes,
} from "date-fns"
import type { Booking } from "./api"

export type CalendarRange = {
  startsAt: string
  endsAt: string
}

export type PackedBooking = Booking & {
  column: number
  columnCount: number
}

export const dayStartHour = 8
export const dayEndHour = 22
export const snapStepMinutes = 30
export const hourHeightPx = 56

export function startOfWeek(date: Date) {
  return dateFnsStartOfWeek(date, { weekStartsOn: 1 })
}

export function buildWeekDays(date: Date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function minutesSinceDayStart(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
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

export function clampMinutesToDay(minutes: number) {
  return Math.min(dayEndHour * 60, Math.max(dayStartHour * 60, minutes))
}

export function dateAtMinutes(day: Date, minutes: number) {
  return addMinutes(setMinutes(setHours(day, 0), 0), minutes)
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
  return bookings.filter((booking) => isSameLocalDay(new Date(booking.startsAt), day))
}

export function packOverlaps(bookings: Booking[]): PackedBooking[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const active: PackedBooking[] = []
  const packed: PackedBooking[] = []

  for (const booking of sorted) {
    const startsAt = new Date(booking.startsAt)
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (new Date(active[index].endsAt) <= startsAt) {
        active.splice(index, 1)
      }
    }

    const usedColumns = new Set(active.map((item) => item.column))
    let column = 0
    while (usedColumns.has(column)) {
      column += 1
    }

    const packedBooking: PackedBooking = {
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
  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  const top = minutesToY(minutesSinceDayStart(start))
  const height = Math.max(24, minutesToY(minutesSinceDayStart(end)) - top)
  const width = 100 / booking.columnCount
  const left = booking.column * width

  return {
    top,
    height,
    left,
    width,
  }
}

function isSameLocalDay(a: Date, b: Date) {
  return isSameDay(a, b)
}
