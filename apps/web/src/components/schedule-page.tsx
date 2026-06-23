import { addDays, format, isSameDay, isSameWeek, startOfWeek } from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MonitorCog } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useWorkspace } from "@/components/app-workspace-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { WeekCalendar } from "@/components/week-calendar"
import type { Booking } from "@/lib/api"
import {
  bookingStyle,
  bookingsForDay,
  dayEndHour,
  dayStartHour,
  defaultVisibleStartHour,
  hourHeightPx,
  packOverlaps,
} from "@/lib/calendar-geometry"
import { dayAgendaDefaultRange } from "@/lib/schedule-defaults"
import { formatDate, formatTime, toLabDateValue } from "@/lib/time"
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
    canEditBooking,
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
  const pendingMobileDayRef = useRef<Date | null>(null)
  const weekDisplayEnd = mobileDays.at(-1) ?? new Date(weekRange.end)
  const scheduleStats = [
    { label: "Week", value: String(dashboardStats.weekBookings) },
    { label: "Today", value: String(dashboardStats.todayBookings) },
    { label: "Booked", value: `${dashboardStats.weekHours}h` },
    { label: "Service", value: String(dashboardStats.maintenanceCount) },
  ]

  useEffect(() => {
    const firstVisibleDay = mobileDays[0]
    if (!firstVisibleDay) {
      return
    }

    const selectedDayIsVisible = mobileDays.some((day) => isSameDay(day, selectedDay))
    const pendingMobileDay = pendingMobileDayRef.current

    if (pendingMobileDay) {
      if (mobileDays.some((day) => isSameDay(day, pendingMobileDay))) {
        setSelectedDay(pendingMobileDay)
        pendingMobileDayRef.current = null
      }
      return
    }

    if (!selectedDayIsVisible) {
      setSelectedDay(
        isSameWeek(new Date(), firstVisibleDay, { weekStartsOn: 1 }) ? new Date() : firstVisibleDay,
      )
    }
  }, [mobileDays, selectedDay])

  function selectMobileDay(day: Date) {
    if (!mobileDays.some((visibleDay) => isSameDay(visibleDay, day))) {
      pendingMobileDayRef.current = day
      goToWeek(day)
    }
    setSelectedDay(day)
  }

  function selectToday() {
    pendingMobileDayRef.current = null
    setSelectedDay(new Date())
    goToCurrentWeek()
  }

  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-semibold text-2xl tracking-tight">
              {selectedMachine?.name ?? "Machine"} schedule
            </h1>
            <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
              {selectedMachine?.active ? "available" : "inactive"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
            <span className="hidden w-44 shrink-0 tabular-nums xl:inline-block">
              {formatDate(weekRange.start)} - {formatDate(weekDisplayEnd)}
            </span>
            {selectedMachine?.specs[0] ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MonitorCog aria-hidden="true" />
                <span className="truncate">{selectedMachine.specs[0]}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 xl:max-w-[520px] xl:justify-end">
          {scheduleStats.map((stat) => (
            <ScheduleStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>

      <section className="mb-3 rounded-lg border border-border bg-card p-3 xl:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-sm">Day agenda</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={selectToday}>
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => createRange(dayAgendaDefaultRange(selectedDay))}
            >
              Book
            </Button>
          </div>
        </div>
        <MobileDayNavigation
          selectedDate={selectedDay}
          onPrevious={() => selectMobileDay(addDays(selectedDay, -1))}
          onNext={() => selectMobileDay(addDays(selectedDay, 1))}
          onSelectDate={selectMobileDay}
        />
        <div className="mb-3 grid grid-cols-7 gap-1">
          {mobileDays.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              className="grid min-w-0 rounded-md border border-transparent px-1 py-1.5 text-center transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/35 data-[active=true]:bg-accent"
              data-active={isSameDay(day, selectedDay)}
              data-mobile-day
              onClick={() => selectMobileDay(day)}
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
          onEditBooking={editBooking}
        />
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm xl:block">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-border border-b bg-muted/40 px-3 py-2">
          <span className="truncate font-medium text-sm">Week board</span>
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
            canEditBooking={canEditBooking}
          />
        </div>
      </section>
    </main>
  )
}

function MobileDayNavigation({
  selectedDate,
  onPrevious,
  onNext,
  onSelectDate,
}: {
  selectedDate: Date
  onPrevious: () => void
  onNext: () => void
  onSelectDate: (date: Date) => void
}) {
  const dayLabel = format(selectedDate, "EEE, MMM d")

  return (
    <div className="mb-3 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div
        data-mobile-day-picker
        className="relative flex h-[44px] min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 font-medium text-sm shadow-xs"
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{dayLabel}</span>
        <Input
          type="date"
          value={toLabDateValue(selectedDate)}
          aria-label="Agenda day"
          className="absolute inset-0 h-[44px] min-h-[44px] w-full cursor-pointer opacity-0"
          onChange={(event) => {
            if (event.target.value) {
              onSelectDate(new Date(`${event.target.value}T12:00:00`))
            }
          }}
        />
      </div>
      <Button type="button" variant="outline" size="icon" aria-label="Next day" onClick={onNext}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
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
    <div
      className={cn(
        "grid w-full grid-cols-[2.75rem_auto_auto_2.75rem] items-center justify-start gap-2 max-[360px]:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] sm:inline-flex sm:w-auto sm:gap-1.5",
        className,
      )}
    >
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-[clamp(9rem,42vw,10rem)] justify-center max-[360px]:w-full sm:w-36 sm:justify-start"
          >
            <CalendarDays data-icon="inline-start" aria-hidden="true" />
            <span className="truncate">Week of {weekLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="max-w-[calc(100vw-2rem)] p-0"
          align="start"
          sideOffset={8}
          collisionPadding={16}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onSelectDate(date)
              }
              setPickerOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-[360px]:col-start-2 max-[360px]:row-start-2 max-[360px]:w-full"
        onClick={onToday}
      >
        Today
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="max-[360px]:col-start-3 max-[360px]:row-start-1"
        aria-label="Next week"
        onClick={onNext}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  )
}

function MobileDayTimeline({
  day,
  bookings,
  pendingBookingId,
  onEditBooking,
}: {
  day: Date
  bookings: Booking[]
  pendingBookingId?: string | null
  onEditBooking: ReturnType<typeof useWorkspace>["editBooking"]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const packedBookings = useMemo(() => packOverlaps(bookings), [bookings])
  const hours = useMemo(
    () => Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index),
    [],
  )

  const dayScrollKey = day.toISOString()

  useEffect(() => {
    void dayScrollKey
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (defaultVisibleStartHour - dayStartHour) * hourHeightPx
    }
  }, [dayScrollKey])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div
        data-mobile-day-timeline-header
        className="flex items-center justify-between border-border border-b bg-muted/30 px-3 py-2"
      >
        <div className="inline-flex items-center gap-2 text-muted-foreground text-xs">
          <Clock3 className="size-3.5" aria-hidden="true" />
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
        ref={scrollRef}
        data-mobile-day-timeline
        className="grid grid-cols-[44px_minmax(0,1fr)] overflow-y-auto pt-2 pb-1"
        style={{ maxHeight: "min(58vh, 680px)" }}
      >
        <div
          className="relative border-border border-r bg-muted/25"
          style={{ height: (dayEndHour - dayStartHour) * hourHeightPx }}
        >
          {hours.slice(0, -1).map((hour) => (
            <div
              key={hour}
              className={`absolute right-2 text-muted-foreground text-[11px] tabular-nums ${
                hour === dayStartHour ? "" : "-translate-y-2"
              }`}
              style={{ top: hour === dayStartHour ? 4 : (hour - dayStartHour) * hourHeightPx }}
            >
              {hour}:00
            </div>
          ))}
        </div>

        <div
          className="relative touch-pan-y bg-card"
          style={{ height: (dayEndHour - dayStartHour) * hourHeightPx }}
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
                onClick={() => {
                  onEditBooking(booking)
                }}
              >
                <div className="truncate font-medium leading-tight">{booking.title}</div>
                <div className="truncate text-muted-foreground tabular-nums">
                  {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ScheduleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-sm shadow-xs">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
