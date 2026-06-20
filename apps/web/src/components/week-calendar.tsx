import { format } from "date-fns"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Booking } from "@/lib/api"
import {
  bookingStyle,
  bookingsForDay,
  buildWeekDays,
  type CalendarRange,
  dateAtMinutes,
  dayEndHour,
  dayStartHour,
  defaultRangeAtMinutes,
  hasConflict,
  hourHeightPx,
  minutesSinceDayStart,
  moveRangeToDayAndMinutes,
  normalizeRange,
  packOverlaps,
  resizeRangeEnd,
  resizeRangeStart,
  yToMinutes,
} from "@/lib/calendar-geometry"
import { formatTime } from "@/lib/time"

type WeekCalendarProps = {
  bookings: Booking[]
  weekDate: Date
  pendingBookingId?: string | null
  onCreateRange: (range: CalendarRange) => void
  onEditBooking: (booking: Booking) => void
  onMoveBooking: (booking: Booking, range: CalendarRange) => void
  onResizeBooking: (booking: Booking, range: CalendarRange) => void
}

type Draft =
  | {
      kind: "create"
      day: Date
      startY: number
      currentY: number
      columnTop: number
    }
  | {
      kind: "move"
      day: Date
      booking: Booking
      startX: number
      currentX: number
      startY: number
      currentY: number
      originStartMinutes: number
    }
  | {
      kind: "resize-end"
      booking: Booking
      startY: number
      currentY: number
    }
  | {
      kind: "resize-start"
      booking: Booking
      startY: number
      currentY: number
    }

const hours = Array.from(
  { length: dayEndHour - dayStartHour + 1 },
  (_, index) => dayStartHour + index,
)

export function WeekCalendar({
  bookings,
  weekDate,
  pendingBookingId,
  onCreateRange,
  onEditBooking,
  onMoveBooking,
  onResizeBooking,
}: WeekCalendarProps) {
  const days = useMemo(() => buildWeekDays(weekDate), [weekDate])
  const [draft, setDraft] = useState<Draft | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!draft) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              ...(current.kind === "move" ? { currentX: event.clientX } : {}),
              currentY: event.clientY,
            }
          : current,
      )
    }

    const onPointerUp = () => {
      if (!draft) {
        return
      }

      const moved = Math.abs(draft.currentY - draft.startY) > 4
      suppressClickRef.current = moved

      if (draft.kind === "create") {
        const startMinutes = yToMinutes(draft.startY - draft.columnTop)
        const range = moved
          ? normalizeRange(draft.day, startMinutes, yToMinutes(draft.currentY - draft.columnTop))
          : defaultRangeAtMinutes(draft.day, startMinutes)
        onCreateRange(range)
      }

      if (draft.kind === "move" && moved) {
        const deltaMinutes = yToMinutes(draft.currentY - draft.startY) - dayStartHour * 60
        const day = dayFromX(draft.currentX) ?? draft.day
        const range = moveRangeToDayAndMinutes(
          draft.booking,
          day,
          draft.originStartMinutes + deltaMinutes,
        )
        onMoveBooking(draft.booking, range)
      }

      if (draft.kind === "resize-end" && moved) {
        const end = new Date(draft.booking.endsAt)
        const originalEndMinutes = minutesSinceDayStart(end)
        const deltaMinutes = yToMinutes(draft.currentY - draft.startY) - dayStartHour * 60
        const range = resizeRangeEnd(draft.booking, originalEndMinutes + deltaMinutes)
        onResizeBooking(draft.booking, range)
      }

      if (draft.kind === "resize-start" && moved) {
        const start = new Date(draft.booking.startsAt)
        const originalStartMinutes = minutesSinceDayStart(start)
        const deltaMinutes = yToMinutes(draft.currentY - draft.startY) - dayStartHour * 60
        const range = resizeRangeStart(draft.booking, originalStartMinutes + deltaMinutes)
        onResizeBooking(draft.booking, range)
      }

      setDraft(null)
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp, { once: true })

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [draft, onCreateRange, onMoveBooking, onResizeBooking])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[52px_repeat(7,minmax(92px,1fr))] border-border border-b bg-card">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="border-border border-l px-2.5 py-2">
              <div className="truncate font-medium text-sm">{format(day, "EEE d")}</div>
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-[52px_repeat(7,minmax(92px,1fr))]"
          style={{ height: (dayEndHour - dayStartHour) * hourHeightPx }}
        >
          <div className="relative border-border border-r bg-muted/25">
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-2 text-muted-foreground text-[11px] tabular-nums"
                style={{ top: (hour - dayStartHour) * hourHeightPx }}
              >
                {hour}:00
              </div>
            ))}
          </div>

          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              bookings={bookings}
              draft={draft}
              pendingBookingId={pendingBookingId}
              suppressClickRef={suppressClickRef}
              onDraft={setDraft}
              onEditBooking={onEditBooking}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  bookings,
  draft,
  pendingBookingId,
  suppressClickRef,
  onDraft,
  onEditBooking,
}: {
  day: Date
  bookings: Booking[]
  draft: Draft | null
  pendingBookingId?: string | null
  suppressClickRef: React.MutableRefObject<boolean>
  onDraft: (draft: Draft) => void
  onEditBooking: (booking: Booking) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dayBookings = packOverlaps(bookingsForDay(bookings, day))
  const draftRange = draftToRange(draft, day, ref.current)

  return (
    <div
      ref={ref}
      data-calendar-day={day.toISOString()}
      className="relative touch-none select-none border-border border-l bg-background"
      onPointerDown={(event) => {
        if (event.button !== 0 || event.target !== event.currentTarget) {
          return
        }

        const rect = event.currentTarget.getBoundingClientRect()
        onDraft({
          kind: "create",
          day,
          startY: event.clientY,
          currentY: event.clientY,
          columnTop: rect.top,
        })
        safelySetPointerCapture(event.currentTarget, event.pointerId)

        const minutes = yToMinutes(event.clientY - rect.top)
        const start = dateAtMinutes(day, minutes)
        start.setSeconds(0, 0)
      }}
    >
      {hours.slice(0, -1).map((hour) => (
        <div
          key={hour}
          className="pointer-events-none absolute inset-x-0 border-border border-t"
          style={{ top: (hour - dayStartHour) * hourHeightPx }}
        />
      ))}

      {dayBookings.map((booking) => {
        const style = bookingStyle(booking)
        const conflicts = hasConflict(booking, bookings, booking.id)
        return (
          <button
            key={booking.id}
            type="button"
            className="group absolute overflow-hidden rounded-[6px] border px-2 py-1 text-left text-xs shadow-sm transition-[box-shadow,transform,opacity] duration-150 hover:shadow-md hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            data-booking-id={booking.id}
            data-pending={pendingBookingId === booking.id || undefined}
            style={{
              top: style.top,
              height: style.height,
              left: `calc(${style.left}% + 2px)`,
              width: `calc(${style.width}% - 4px)`,
              background:
                booking.type === "maintenance" ? "var(--color-muted)" : "var(--color-card)",
              borderColor: conflicts
                ? "var(--color-destructive)"
                : booking.type === "maintenance"
                  ? "var(--color-border)"
                  : "color-mix(in oklch, var(--color-primary) 34%, var(--color-border))",
              opacity: pendingBookingId === booking.id ? 0.55 : 1,
            }}
            onClick={() => {
              if (!suppressClickRef.current) {
                onEditBooking(booking)
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return
              }

              event.stopPropagation()
              const start = new Date(booking.startsAt)
              onDraft({
                kind: "move",
                day,
                booking,
                startX: event.clientX,
                currentX: event.clientX,
                startY: event.clientY,
                currentY: event.clientY,
                originStartMinutes: minutesSinceDayStart(start),
              })
            }}
          >
            <span
              className="absolute top-0 right-1 left-1 flex h-3 cursor-ns-resize items-start justify-center pt-1"
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return
                }

                event.stopPropagation()
                onDraft({
                  kind: "resize-start",
                  booking,
                  startY: event.clientY,
                  currentY: event.clientY,
                })
              }}
            >
              <span className="h-0.5 w-8 rounded-full bg-muted-foreground/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </span>
            <div className="truncate font-medium leading-tight">{booking.title}</div>
            <div className="truncate text-muted-foreground tabular-nums">
              {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
            </div>
            <span
              className="absolute right-1 bottom-0 left-1 flex h-3 cursor-ns-resize items-end justify-center pb-1"
              onPointerDown={(event) => {
                if (event.button !== 0) {
                  return
                }

                event.stopPropagation()
                onDraft({
                  kind: "resize-end",
                  booking,
                  startY: event.clientY,
                  currentY: event.clientY,
                })
              }}
            >
              <span className="h-0.5 w-8 rounded-full bg-muted-foreground/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </span>
          </button>
        )
      })}

      {draftRange ? (
        <div
          className="pointer-events-none absolute right-1 left-1 rounded-md border border-primary bg-primary/12 shadow-sm"
          style={{
            top: draftRange.top,
            height: draftRange.height,
          }}
        />
      ) : null}
    </div>
  )
}

function draftToRange(draft: Draft | null, day: Date, column: HTMLDivElement | null) {
  if (!draft || !column) {
    return null
  }

  if (draft.kind !== "create" || !sameDate(draft.day, day)) {
    return null
  }

  const rect = column.getBoundingClientRect()
  const top = Math.min(draft.startY, draft.currentY) - rect.top
  const height = Math.max(24, Math.abs(draft.currentY - draft.startY))
  return { top, height }
}

function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dayFromX(clientX: number) {
  const columns = Array.from(document.querySelectorAll<HTMLElement>("[data-calendar-day]"))
  const column = columns.find((element) => {
    const rect = element.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right
  })
  const value = column?.dataset.calendarDay
  return value ? new Date(value) : null
}

function safelySetPointerCapture(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    // Synthetic pointer events and some interrupted browser gestures do not have
    // an active pointer to capture. The global move/up listeners still handle it.
  }
}
