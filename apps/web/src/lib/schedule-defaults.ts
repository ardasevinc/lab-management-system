import {
  type CalendarRange,
  dayStartHour,
  defaultRangeAtMinutes,
  minutesSinceDayStart,
} from "./calendar-geometry"
import { toLabDateValue } from "./time"

export function dayAgendaDefaultRange(day: Date, now = new Date()): CalendarRange {
  const startMinutes =
    toLabDateValue(day) === toLabDateValue(now) ? minutesSinceDayStart(now) : dayStartHour * 60

  return defaultRangeAtMinutes(day, startMinutes)
}
