import type { ApiHealth } from "@/lib/api"

export type ReminderHealthDisplay = {
  value: string
  detail: string
  badge: string
}

export function getReminderHealthDisplay({
  health,
  isError = false,
}: {
  health?: ApiHealth
  isError?: boolean
}): ReminderHealthDisplay {
  if (isError) {
    return {
      value: "Unknown",
      detail: "Health check unavailable",
      badge: "check",
    }
  }

  const reminders = health?.checks.reminders

  if (!reminders) {
    return {
      value: "Checking",
      detail: "Reading health status",
      badge: "pending",
    }
  }

  if (!reminders.enabled) {
    return {
      value: "Disabled",
      detail: "Start/end reminders off",
      badge: "off",
    }
  }

  return {
    value: "Enabled",
    detail: `Start ${reminders.startReminderMinutes}m, end ${reminders.endingReminderMinutes}m, retry ${reminders.maxAttempts}x`,
    badge: "normal",
  }
}
