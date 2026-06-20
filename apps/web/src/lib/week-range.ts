import { addDays, startOfWeek } from "date-fns"

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  start.setHours(0, 0, 0, 0)
  const end = addDays(start, 7)

  return { start: start.toISOString(), end: end.toISOString() }
}
