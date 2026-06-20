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
  const startsFallback = new Date(now)
  startsFallback.setMinutes(0, 0, 0)
  const endsFallback = new Date(startsFallback.getTime() + 60 * 60_000)

  return {
    title: booking?.title ?? "",
    notes: booking?.notes ?? "",
    type: booking?.type ?? initialType,
    startsDate: toLabDateValue(booking?.startsAt ?? initialRange?.startsAt ?? startsFallback),
    startsTime: toLabTimeValue(booking?.startsAt ?? initialRange?.startsAt ?? startsFallback),
    endsDate: toLabDateValue(booking?.endsAt ?? initialRange?.endsAt ?? endsFallback),
    endsTime: toLabTimeValue(booking?.endsAt ?? initialRange?.endsAt ?? endsFallback),
  }
}
