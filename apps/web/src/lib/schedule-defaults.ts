import {
  type CalendarRange,
  defaultBookingStartHour,
  defaultRangeAtMinutes,
  minutesSinceDayStart,
  snapMinutesUp,
} from "./calendar-geometry"
import { toLabDateValue } from "./time"

export function dayAgendaDefaultRange(day: Date, now = new Date()): CalendarRange {
  const startMinutes =
    toLabDateValue(day) === toLabDateValue(now)
      ? snapMinutesUp(minutesSinceDayStart(now))
      : defaultBookingStartHour * 60

  return defaultRangeAtMinutes(day, startMinutes)
}
