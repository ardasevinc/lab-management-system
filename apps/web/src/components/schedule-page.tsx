import { addDays, format, isSameDay, startOfWeek } from "date-fns"
import { CalendarDays, Clock3, MonitorCog } from "lucide-react"
import { useMemo, useState } from "react"
import { useWorkspace } from "@/components/app-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { WeekCalendar } from "@/components/week-calendar"
import { formatDate, formatTime } from "@/lib/time"

export function SchedulePage() {
  const {
    bookings,
    dashboardStats,
    pendingBookingId,
    selectedMachine,
    upcomingBookings,
    weekRange,
    createRange,
    editBooking,
    moveBooking,
    openNewBooking,
    resizeBooking,
  } = useWorkspace()
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const mobileDays = useMemo(() => {
    const weekStart = startOfWeek(new Date(weekRange.start), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [weekRange.start])
  const selectedDayBookings = upcomingBookings.filter((booking) =>
    isSameDay(new Date(booking.startsAt), selectedDay),
  )

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
              {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
            </span>
            {selectedMachine?.specs[0] ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MonitorCog aria-hidden="true" />
                <span className="truncate">{selectedMachine.specs[0]}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[520px]">
          <Metric label="Week" value={String(dashboardStats.weekBookings)} />
          <Metric label="Today" value={String(dashboardStats.todayBookings)} />
          <Metric label="Booked" value={`${dashboardStats.weekHours}h`} />
          <Metric label="Maint." value={String(dashboardStats.maintenanceCount)} />
        </div>
      </div>

      <section className="mb-3 rounded-lg border border-border bg-card p-3 md:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-sm">Day agenda</h2>
            <p className="text-muted-foreground text-xs">{format(selectedDay, "EEEE, MMM d")}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openNewBooking}>
            Book
          </Button>
        </div>
        <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
          {mobileDays.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              className="grid min-w-14 rounded-md border border-transparent px-2 py-1.5 text-center transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/35 data-[active=true]:bg-accent"
              data-active={isSameDay(day, selectedDay)}
              onClick={() => setSelectedDay(day)}
            >
              <span className="text-muted-foreground text-xs">{format(day, "EEE")}</span>
              <span className="font-semibold text-sm tabular-nums">{format(day, "d")}</span>
            </button>
          ))}
        </div>
        <AgendaList bookings={selectedDayBookings} onEditBooking={editBooking} />
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm md:block">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-border border-b bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="text-primary" aria-hidden="true" />
            <span className="truncate font-medium text-sm">Week board</span>
          </div>
          <Button type="button" variant="outline" size="sm">
            This week
          </Button>
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

function AgendaList({
  bookings,
  onEditBooking,
}: {
  bookings: ReturnType<typeof useWorkspace>["upcomingBookings"]
  onEditBooking: ReturnType<typeof useWorkspace>["editBooking"]
}) {
  if (!bookings.length) {
    return (
      <Empty className="items-start py-2 text-left">
        <EmptyHeader>
          <Clock3 className="text-muted-foreground" aria-hidden="true" />
          <EmptyTitle>No upcoming bookings</EmptyTitle>
          <EmptyDescription>The next available slot is open.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid gap-2">
      {bookings.slice(0, 3).map((booking) => (
        <button
          key={booking.id}
          type="button"
          className="rounded-md border border-border bg-muted/25 px-3 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onEditBooking(booking)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-sm">{booking.title}</span>
            {booking.type === "maintenance" ? <Badge variant="outline">maintenance</Badge> : null}
          </div>
          <div className="mt-1 text-muted-foreground text-xs tabular-nums">
            {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} -{" "}
            {formatTime(booking.endsAt)}
          </div>
        </button>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg tabular-nums leading-tight">{value}</div>
    </div>
  )
}
