import { format, parseISO } from "date-fns"

export function toLocalDateValue(value: string | Date) {
  return format(toDate(value), "yyyy-MM-dd")
}

export function toLocalTimeValue(value: string | Date) {
  return format(toDate(value), "HH:mm")
}

export function fromLocalDateTimeParts(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

export function toLocalInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function fromLocalInputValue(value: string) {
  return new Date(value).toISOString()
}

export function formatTime(value: string | Date) {
  return format(toDate(value), "HH:mm")
}

export function formatDate(value: string | Date) {
  return format(toDate(value), "EEE, MMM d")
}

function toDate(value: string | Date) {
  return typeof value === "string" ? parseISO(value) : value
}
