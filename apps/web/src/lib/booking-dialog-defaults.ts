import type { Booking } from "./api"
import { toLabDateValue, toLabTimeValue } from "./time"

export type BookingDialogDefaults = {
  title: string
  notes: string
  type: Booking["type"]
  startsDate: string
  startsTime: string
  endsDate: string
  endsTime: string
}

export function getRoundedOneHourRange(now = new Date()) {
  const startsAt = new Date(now)
  startsAt.setMinutes(0, 0, 0)
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000)

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  }
}

export function getBookingDialogDefaults({
  booking,
  initialRange,
  initialType = "normal",
  now = new Date(),
}: {
  booking: Booking | null
  initialRange?: { startsAt: string; endsAt: string } | null
  initialType?: Booking["type"]
  now?: Date
}): BookingDialogDefaults {
  const fallbackRange = getRoundedOneHourRange(now)

  return {
    title: booking?.title ?? "",
    notes: booking?.notes ?? "",
    type: booking?.type ?? initialType,
    startsDate: toLabDateValue(
      booking?.startsAt ?? initialRange?.startsAt ?? fallbackRange.startsAt,
    ),
    startsTime: toLabTimeValue(
      booking?.startsAt ?? initialRange?.startsAt ?? fallbackRange.startsAt,
    ),
    endsDate: toLabDateValue(booking?.endsAt ?? initialRange?.endsAt ?? fallbackRange.endsAt),
    endsTime: toLabTimeValue(booking?.endsAt ?? initialRange?.endsAt ?? fallbackRange.endsAt),
  }
}
