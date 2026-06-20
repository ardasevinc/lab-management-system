import { labConfig } from "@lab/config"

const labTimeZone = labConfig.defaultTimezone

export function labTimezone() {
  return labTimeZone
}

export function toLabDateValue(value: string | Date) {
  const parts = dateTimeParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function toLabTimeValue(value: string | Date) {
  const parts = dateTimeParts(value)
  return `${parts.hour}:${parts.minute}`
}

export function fromLabDateTimeParts(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  const offset = timeZoneOffsetMs(new Date(wallTimeAsUtc))
  const utc = wallTimeAsUtc - offset
  const correctedOffset = timeZoneOffsetMs(new Date(utc))

  return new Date(wallTimeAsUtc - correctedOffset).toISOString()
}

export function addLabDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days, 12))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function startOfLabWeek(value: string | Date) {
  const date = toLabDateValue(value)
  const [year, month, day] = date.split("-").map(Number)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12))
  const dayOfWeek = noonUtc.getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  return addLabDays(date, -daysSinceMonday)
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
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: labTimeZone,
  }).format(toDate(value))
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: labTimeZone,
  }).format(toDate(value))
}

export function formatDateTime(value: string | Date) {
  return `${formatDate(value)} ${formatTime(value)} ${labTimeZone}`
}

export const toLocalDateValue = toLabDateValue
export const toLocalTimeValue = toLabTimeValue
export const fromLocalDateTimeParts = fromLabDateTimeParts

function toDate(value: string | Date) {
  return typeof value === "string" ? new Date(value) : value
}

function dateTimeParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: labTimeZone,
  }).formatToParts(toDate(value))

  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
    hour: part(parts, "hour"),
    minute: part(parts, "minute"),
  }
}

function timeZoneOffsetMs(date: Date) {
  const parts = dateTimeParts(date)
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )

  return asUtc - date.getTime()
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((item) => item.type === type)?.value
  if (!value) {
    throw new Error(`Missing ${type} date part`)
  }

  return value
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}
