import { addLabDays, fromLabDateTimeParts, startOfLabWeek } from "./time"

export function getWeekRange(date: Date) {
  const start = startOfLabWeek(date)
  const end = addLabDays(start, 7)

  return {
    start: fromLabDateTimeParts(start, "00:00"),
    end: fromLabDateTimeParts(end, "00:00"),
  }
}
