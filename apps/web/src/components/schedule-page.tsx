import { addDays, format, isSameDay, isSameWeek, startOfWeek } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MonitorCog } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useWorkspace } from "@/components/app-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { WeekCalendar } from "@/components/week-calendar"
import type { Booking } from "@/lib/api"
import {
  bookingStyle,
  bookingsForDay,
  type CalendarRange,
  dayEndHour,
  dayStartHour,
  defaultRangeAtMinutes,
  hourHeightPx,
  normalizeRange,
  packOverlaps,
  yToMinutes,
} from "@/lib/calendar-geometry"
import { dayAgendaDefaultRange } from "@/lib/schedule-defaults"
import { formatDate, formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export function SchedulePage() {
  const {
    bookings,
    dashboardStats,
    pendingBookingId,
    selectedMachine,
    weekRange,
    createRange,
    editBooking,
    goToCurrentWeek,
    goToNextWeek,
    goToPreviousWeek,
    goToWeek,
    moveBooking,
    resizeBooking,
  } = useWorkspace()
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const mobileDays = useMemo(() => {
    const weekStart = startOfWeek(new Date(weekRange.start), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [weekRange.start])
  const selectedDayBookings = useMemo(
    () => bookingsForDay(bookings, selectedDay),
    [bookings, selectedDay],
  )
  const weekDisplayEnd = mobileDays.at(-1) ?? new Date(weekRange.end)

  useEffect(() => {
    const firstVisibleDay = mobileDays[0]
    if (!firstVisibleDay) {
      return
    }

    const selectedDayIsVisible = mobileDays.some((day) => isSameDay(day, selectedDay))

    if (!selectedDayIsVisible) {
      setSelectedDay(
        isSameWeek(new Date(), firstVisibleDay, { weekStartsOn: 1 }) ? new Date() : firstVisibleDay,
      )
    }
  }, [mobileDays, selectedDay])

  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-semibold text-2xl tracking-tight">
              {selectedMachine?.name ?? "Machine"} schedule
            </h1>
            <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
              {selectedMachine?.active ? "bookable" : "inactive"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" />
              {formatDate(weekRange.start)} - {formatDate(weekDisplayEnd)}
            </span>
            {selectedMachine?.specs[0] ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MonitorCog aria-hidden="true" />
                <span className="truncate">{selectedMachine.specs[0]}</span>
              </span>
            ) : null}
          </div>
          <WeekNavigation
            className="mt-3 lg:hidden"
            selectedDate={new Date(weekRange.start)}
            onPrevious={goToPreviousWeek}
            onToday={goToCurrentWeek}
            onNext={goToNextWeek}
            onSelectDate={goToWeek}
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 xl:w-[520px]">
          <Metric label="Week" value={String(dashboardStats.weekBookings)} />
          <Metric label="Today" value={String(dashboardStats.todayBookings)} />
          <Metric label="Booked" value={`${dashboardStats.weekHours}h`} />
          <Metric label="Service" value={String(dashboardStats.maintenanceCount)} />
        </div>
      </div>

      <section className="mb-3 rounded-lg border border-border bg-card p-3 lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-sm">Day agenda</h2>
            <p className="text-muted-foreground text-xs">{format(selectedDay, "EEEE, MMM d")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => createRange(dayAgendaDefaultRange(selectedDay))}
          >
            Book
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-7 gap-1">
          {mobileDays.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              className="grid min-w-0 rounded-md border border-transparent px-1 py-1.5 text-center transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/35 data-[active=true]:bg-accent"
              data-active={isSameDay(day, selectedDay)}
              data-mobile-day
              onClick={() => setSelectedDay(day)}
            >
              <span className="text-muted-foreground text-xs">{format(day, "EEE")}</span>
              <span className="font-semibold text-sm tabular-nums">{format(day, "d")}</span>
            </button>
          ))}
        </div>
        <MobileDayTimeline
          day={selectedDay}
          bookings={selectedDayBookings}
          pendingBookingId={pendingBookingId}
          onCreateRange={createRange}
          onEditBooking={editBooking}
        />
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:block">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-border border-b bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="text-primary" aria-hidden="true" />
            <span className="truncate font-medium text-sm">Week board</span>
          </div>
          <WeekNavigation
            selectedDate={new Date(weekRange.start)}
            onPrevious={goToPreviousWeek}
            onToday={goToCurrentWeek}
            onNext={goToNextWeek}
            onSelectDate={goToWeek}
          />
        </div>
        <div className="calendar-frame">
          <WeekCalendar
            bookings={bookings}
            weekDate={new Date(weekRange.start)}
            pendingBookingId={pendingBookingId}
            onCreateRange={createRange}
            onEditBooking={editBooking}
            onMoveBooking={moveBooking}
            onResizeBooking={resizeBooking}
          />
        </div>
      </section>
    </main>
  )
}

function WeekNavigation({
  className,
  selectedDate,
  onPrevious,
  onToday,
  onNext,
  onSelectDate,
}: {
  className?: string
  selectedDate: Date
  onPrevious: () => void
  onToday: () => void
  onNext: () => void
  onSelectDate: (date: Date) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const weekLabel = format(selectedDate, "MMM d")

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous week"
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="min-w-28 justify-start">
            <CalendarDays data-icon="inline-start" aria-hidden="true" />
            <span className="truncate">Week of {weekLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onSelectDate(date)
                setPickerOpen(false)
              }
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Button type="button" variant="outline" size="sm" onClick={onToday}>
        Today
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Next week" onClick={onNext}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  )
}

function MobileDayTimeline({
  day,
  bookings,
  pendingBookingId,
  onCreateRange,
  onEditBooking,
}: {
  day: Date
  bookings: Booking[]
  pendingBookingId?: string | null
  onCreateRange: (range: CalendarRange) => void
  onEditBooking: ReturnType<typeof useWorkspace>["editBooking"]
}) {
  const laneRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{
    startY: number
    currentY: number
    columnTop: number
  } | null>(null)
  const packedBookings = useMemo(() => packOverlaps(bookings), [bookings])
  const hours = useMemo(
    () => Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index),
    [],
  )

  useEffect(() => {
    if (!draft) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      setDraft((current) => (current ? { ...current, currentY: event.clientY } : current))
    }

    const onPointerUp = () => {
      if (!draft) {
        return
      }

      const moved = Math.abs(draft.currentY - draft.startY) > 4
      const startMinutes = yToMinutes(draft.startY - draft.columnTop)
      const range = moved
        ? normalizeRange(day, startMinutes, yToMinutes(draft.currentY - draft.columnTop))
        : defaultRangeAtMinutes(day, startMinutes)

      onCreateRange(range)
      setDraft(null)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp, { once: true })

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [day, draft, onCreateRange])

  const draftStyle = getMobileDraftStyle(draft, laneRef.current)

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex items-center justify-between border-border border-b bg-muted/30 px-3 py-2">
        <div className="inline-flex items-center gap-2 text-muted-foreground text-xs">
          <Clock3 aria-hidden="true" />
          <span>{dayStartHour}:00</span>
          <span>-</span>
          <span>{dayEndHour}:00</span>
        </div>
        <span className="text-muted-foreground text-xs">
          {bookings.length
            ? `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`
            : "open"}
        </span>
      </div>

      <div
        className="grid grid-cols-[44px_minmax(0,1fr)] overflow-y-auto"
        style={{ maxHeight: "min(58vh, 680px)" }}
      >
        <div
          className="relative border-border border-r bg-muted/25"
          style={{ height: (dayEndHour - dayStartHour) * hourHeightPx }}
        >
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

        <div
          ref={laneRef}
          className="relative touch-none select-none bg-card"
          style={{ height: (dayEndHour - dayStartHour) * hourHeightPx }}
          onPointerDown={(event) => {
            if (event.button !== 0 || event.target !== event.currentTarget) {
              return
            }

            const rect = event.currentTarget.getBoundingClientRect()
            setDraft({
              startY: event.clientY,
              currentY: event.clientY,
              columnTop: rect.top,
            })
            safelySetPointerCapture(event.currentTarget, event.pointerId)
          }}
        >
          {hours.slice(0, -1).map((hour) => (
            <div
              key={hour}
              className="pointer-events-none absolute inset-x-0 border-border border-t"
              style={{ top: (hour - dayStartHour) * hourHeightPx }}
            />
          ))}
          {packedBookings.map((booking) => {
            const style = bookingStyle(booking)
            return (
              <button
                key={booking.id}
                type="button"
                className="absolute overflow-hidden rounded-[7px] border px-2.5 py-1.5 text-left text-xs shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-booking-id={booking.id}
                data-pending={pendingBookingId === booking.id || undefined}
                style={{
                  top: style.top,
                  height: style.height,
                  left: `calc(${style.left}% + 4px)`,
                  width: `calc(${style.width}% - 8px)`,
                  background:
                    booking.type === "maintenance" ? "var(--color-muted)" : "var(--color-card)",
                  borderColor:
                    booking.type === "maintenance"
                      ? "var(--color-border)"
                      : "color-mix(in oklch, var(--color-primary) 34%, var(--color-border))",
                  opacity: pendingBookingId === booking.id ? 0.55 : 1,
                }}
                onClick={() => onEditBooking(booking)}
              >
                <div className="truncate font-medium leading-tight">{booking.title}</div>
                <div className="truncate text-muted-foreground tabular-nums">
                  {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                </div>
              </button>
            )
          })}

          {draftStyle ? (
            <div
              className="pointer-events-none absolute right-2 left-2 rounded-md border border-primary bg-primary/12 shadow-sm"
              style={draftStyle}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getMobileDraftStyle(
  draft: { startY: number; currentY: number } | null,
  lane: HTMLDivElement | null,
) {
  if (!draft || !lane) {
    return null
  }

  const rect = lane.getBoundingClientRect()
  const top = Math.min(draft.startY, draft.currentY) - rect.top
  const height = Math.max(28, Math.abs(draft.currentY - draft.startY))

  return { top, height }
}

function safelySetPointerCapture(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    // Synthetic pointer events and some interrupted browser gestures do not have
    // an active pointer to capture. The global move/up listeners still handle it.
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5 shadow-sm sm:px-3 sm:py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-base tabular-nums leading-tight sm:text-lg">{value}</div>
    </div>
  )
}
