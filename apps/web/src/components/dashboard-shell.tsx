import { labConfig } from "@lab/config"
import {
  Activity,
  CalendarDays,
  Clock3,
  Cpu,
  LogOut,
  MailPlus,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react"
import type { Booking, Machine, User } from "@/lib/api"
import type { CalendarRange } from "@/lib/calendar-geometry"
import { formatDate, formatTime } from "@/lib/time"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Field, FieldGroup, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Separator } from "./ui/separator"
import { WeekCalendar } from "./week-calendar"

type DashboardStats = {
  maintenanceCount: number
  todayBookings: number
  weekBookings: number
  weekHours: number
}

type DashboardShellProps = {
  user: User
  machines: Machine[]
  selectedMachine: Machine | null
  selectedMachineSlug: string
  weekRange: { start: string; end: string }
  bookings: Booking[]
  upcomingBookings: Booking[]
  users: User[]
  dashboardStats: DashboardStats
  pendingBookingId?: string | null
  invitePending: boolean
  onSelectMachine: (slug: string) => void
  onLogout: () => void
  onNewBooking: () => void
  onAddMaintenance: () => void
  onInvite: (form: FormData) => void
  onCreateRange: (range: CalendarRange) => void
  onEditBooking: (booking: Booking) => void
  onMoveBooking: (booking: Booking, range: CalendarRange) => void
  onResizeBooking: (booking: Booking, range: CalendarRange) => void
}

export function DashboardShell({
  user,
  machines,
  selectedMachine,
  selectedMachineSlug,
  weekRange,
  bookings,
  upcomingBookings,
  users,
  dashboardStats,
  pendingBookingId,
  invitePending,
  onSelectMachine,
  onLogout,
  onNewBooking,
  onAddMaintenance,
  onInvite,
  onCreateRange,
  onEditBooking,
  onMoveBooking,
  onResizeBooking,
}: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <a
        href="#calendar-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-sm"
      >
        Skip to calendar
      </a>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-border border-b bg-background/94 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Cpu className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-sm">{labConfig.shortName}</div>
                <div className="truncate text-muted-foreground text-xs">{labConfig.appTitle}</div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="secondary" className="hidden max-w-52 gap-1 sm:flex">
                <UserRound className="size-3" aria-hidden="true" />
                <span className="truncate">{user.name}</span>
                <span className="text-muted-foreground">/ {user.role}</span>
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Log out"
                onClick={onLogout}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
              <Button type="button" size="sm" onClick={onNewBooking}>
                <Plus className="size-4" aria-hidden="true" />
                New booking
              </Button>
            </div>
          </div>
        </header>

        <div className="grid flex-1 xl:grid-cols-[232px_minmax(0,1fr)_304px]">
          <aside className="border-border border-b bg-sidebar/70 p-3 sm:p-4 xl:border-r xl:border-b-0">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="font-medium text-sm">Machines</div>
                <Badge variant="outline">{machines.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {machines.map((machine) => (
                  <button
                    key={machine.id}
                    type="button"
                    className="group rounded-md border border-border bg-card px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 hover:border-primary/30 hover:bg-accent/45 active:scale-[0.99] data-[active=true]:border-primary/40 data-[active=true]:bg-primary/8"
                    data-active={machine.slug === selectedMachineSlug}
                    onClick={() => onSelectMachine(machine.slug)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-sm">{machine.name}</span>
                      <Badge variant={machine.active ? "secondary" : "outline"}>
                        {machine.active ? "bookable" : "offline"}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                      {machine.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <Separator className="my-4" />

            <section className="grid gap-2 px-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Invite-only access
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="outline">{user.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span className="font-medium tabular-nums">{labConfig.defaultTimezone}</span>
              </div>
            </section>
          </aside>

          <section id="calendar-workspace" className="min-w-0 bg-background p-3 sm:p-4">
            <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-semibold text-xl tracking-tight">
                    {selectedMachine?.name ?? "Machine"} schedule
                  </h1>
                  <Badge variant="outline" className="gap-1">
                    <CalendarDays className="size-3" aria-hidden="true" />
                    {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
                  </Badge>
                </div>
                <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
                  Drag to book. Move or resize reservations directly on the calendar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[520px]">
                <Metric label="This week" value={String(dashboardStats.weekBookings)} />
                <Metric label="Today" value={String(dashboardStats.todayBookings)} />
                <Metric label="Booked" value={`${dashboardStats.weekHours}h`} />
                <Metric label="Maint." value={String(dashboardStats.maintenanceCount)} />
              </div>
            </div>

            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-border border-b bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Activity className="size-4 text-primary" aria-hidden="true" />
                  <span className="truncate font-medium text-sm">Week board</span>
                  <span className="hidden text-muted-foreground text-xs sm:inline">
                    server validates overlaps
                  </span>
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
                  onCreateRange={onCreateRange}
                  onEditBooking={onEditBooking}
                  onMoveBooking={onMoveBooking}
                  onResizeBooking={onResizeBooking}
                />
              </div>
            </section>
          </section>

          <aside className="border-border border-t bg-sidebar/70 p-3 sm:p-4 xl:border-t-0 xl:border-l">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <section className="rounded-lg border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-medium text-sm">Machine details</h2>
                    <p className="text-muted-foreground text-xs">{selectedMachine?.slug}</p>
                  </div>
                  <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
                    {selectedMachine?.active ? "active" : "inactive"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{selectedMachine?.accessNotes}</p>
                {selectedMachine?.specs.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedMachine.specs.map((spec) => (
                      <Badge key={spec} variant="outline" className="max-w-full truncate">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium text-sm">Upcoming</h2>
                  <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="grid gap-2">
                  {upcomingBookings.length ? (
                    upcomingBookings.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        className="rounded-md border border-border bg-muted/25 px-3 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onEditBooking(booking)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-sm">{booking.title}</span>
                          {booking.type === "maintenance" ? (
                            <Badge variant="outline">maint.</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-muted-foreground text-xs tabular-nums">
                          {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} -{" "}
                          {formatTime(booking.endsAt)}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-md bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
                      No upcoming bookings this week.
                    </p>
                  )}
                </div>
              </section>

              {user.role === "admin" ? (
                <section className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-medium text-sm">Admin</h2>
                      <p className="text-muted-foreground text-xs">Invite & member access</p>
                    </div>
                    <UsersRound className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onInvite(new FormData(event.currentTarget))
                      event.currentTarget.reset()
                    }}
                  >
                    <FieldGroup className="gap-3">
                      <Field>
                        <FieldLabel htmlFor="invite-email" className="sr-only">
                          Invite email
                        </FieldLabel>
                        <Input
                          id="invite-email"
                          name="email"
                          type="email"
                          placeholder="user@miralab.tr"
                          autoComplete="email"
                          spellCheck={false}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="invite-name" className="sr-only">
                          Invite name
                        </FieldLabel>
                        <Input
                          id="invite-name"
                          name="name"
                          placeholder="Researcher name"
                          autoComplete="name"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="invite-role" className="sr-only">
                          Invite role
                        </FieldLabel>
                        <Select name="role" defaultValue="member">
                          <SelectTrigger id="invite-role" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                    <Button type="submit" className="w-full" disabled={invitePending}>
                      <MailPlus className="size-4" aria-hidden="true" />
                      Invite user
                    </Button>
                  </form>

                  <Separator className="my-3" />

                  <div className="grid gap-1.5">
                    {users.map((listedUser) => (
                      <div
                        key={listedUser.id}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/25 px-2 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate">{listedUser.name}</span>
                        <Badge variant="outline">{listedUser.role}</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {user.role === "admin" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start md:self-start xl:self-auto"
                  onClick={onAddMaintenance}
                >
                  <Wrench className="size-4" aria-hidden="true" />
                  Add maintenance block
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </main>
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
