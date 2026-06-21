import { Navigate } from "@tanstack/react-router"
import { differenceInMinutes, isAfter } from "date-fns"
import { CalendarDays, Clock3, type LucideIcon, MonitorCog, Pencil, Wrench } from "lucide-react"
import { AdminPageFrame } from "@/components/admin-page-frame"
import { useWorkspace } from "@/components/app-workspace-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export function AdminOverviewPage() {
  const workspace = useWorkspace()

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  const nextBooking = workspace.upcomingBookings[0]
  const activeMachines = workspace.machines.filter((machine) => machine.active).length
  const selectedMachine = workspace.selectedMachine
  const weekBookings = [...workspace.bookings].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  )
  const secondarySpecs = selectedMachine?.specs.slice(1).join(", ")
  const machineAvailability = selectedMachine?.active ? "Accepting bookings" : "Inactive"
  const accessValue = selectedMachine?.accessNotes ? "Notes set" : "No notes"
  const accessDetail = selectedMachine?.accessNotes || "Add access notes from Machines."

  return (
    <AdminPageFrame
      title="Admin overview"
      description={selectedMachine?.name ?? "Operations"}
      action={
        <div className="flex items-center gap-2">
          <Button type="button" onClick={workspace.openNewBooking}>
            <Clock3 data-icon="inline-start" aria-hidden="true" />
            New booking
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="sm:hidden"
            aria-label="Maintenance"
            onClick={workspace.openMaintenanceBooking}
          >
            <Wrench aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={workspace.openMaintenanceBooking}
          >
            <Wrench data-icon="inline-start" aria-hidden="true" />
            Maintenance
          </Button>
        </div>
      }
    >
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-medium text-base">
                {selectedMachine?.name ?? "No machine selected"}
              </h2>
              <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
                {selectedMachine?.active ? "available" : "inactive"}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
              {selectedMachine?.description ?? "Select a machine before bookings open."}
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            {workspace.users.length} users
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border xl:grid-cols-4">
          <SummaryPanel
            icon={MonitorCog}
            label="Machines"
            value={`${activeMachines}/${workspace.machines.length}`}
            detail="available"
          />
          <SummaryPanel
            icon={CalendarDays}
            label="Bookings"
            value={String(workspace.dashboardStats.weekBookings)}
            detail="this week"
          />
          <SummaryPanel
            icon={Clock3}
            label="Hours"
            value={`${workspace.dashboardStats.weekHours}h`}
            detail="reserved"
          />
          <SummaryPanel
            icon={Wrench}
            label="Maintenance"
            value={String(workspace.dashboardStats.maintenanceCount)}
            detail="blocks"
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
            <h2 className="font-medium text-sm">Week queue</h2>
            <Badge variant="outline">{weekBookings.length} total</Badge>
          </div>
          {weekBookings.length ? (
            <div className="divide-y divide-border">
              {weekBookings.slice(0, 6).map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  onClick={() => workspace.editBooking(booking)}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">{booking.title}</div>
                    <div className="mt-1 text-muted-foreground text-xs tabular-nums">
                      {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)} -{" "}
                      {formatTime(booking.endsAt)}
                    </div>
                  </div>
                  <Badge variant={booking.type === "maintenance" ? "outline" : "secondary"}>
                    {booking.type === "maintenance" ? "maintenance" : "booking"}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <Empty className="items-start justify-start p-4 text-left">
              <EmptyHeader className="items-start text-left">
                <EmptyTitle>No reservations this week</EmptyTitle>
                <EmptyDescription>
                  {selectedMachine?.name ?? "The selected machine"} is open for new bookings.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-border border-b px-4 py-3">
            <h2 className="font-medium text-sm">Machine status</h2>
          </div>
          <div className="divide-y divide-border">
            <OverviewDetailRow
              label="Next"
              value={nextBooking?.title ?? "Open"}
              detail={
                nextBooking
                  ? `${formatDate(nextBooking.startsAt)} · ${formatTime(nextBooking.startsAt)} - ${formatTime(nextBooking.endsAt)}`
                  : "No upcoming booking"
              }
              badge={nextBooking?.type ?? "open"}
              onClick={nextBooking ? () => workspace.editBooking(nextBooking) : undefined}
            />
            <OverviewDetailRow
              label="Specs"
              value={selectedMachine?.specs[0] ?? "No primary spec"}
              detail={secondarySpecs || machineAvailability}
            />
            <OverviewDetailRow label="Access" value={accessValue} detail={accessDetail} />
          </div>
        </div>
      </section>
    </AdminPageFrame>
  )
}

export function AdminMaintenancePage() {
  const workspace = useWorkspace()

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  const maintenanceBookings = workspace.bookings
    .filter((booking) => booking.type === "maintenance")
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
  const maintenanceHours = maintenanceBookings.reduce(
    (total, booking) =>
      total +
      Math.max(0, differenceInMinutes(new Date(booking.endsAt), new Date(booking.startsAt))) / 60,
    0,
  )
  const nextMaintenance = maintenanceBookings.find((booking) =>
    isAfter(new Date(booking.endsAt), new Date()),
  )

  return (
    <AdminPageFrame
      title="Maintenance"
      description={workspace.selectedMachine?.name ?? "Service windows"}
      action={
        <Button type="button" onClick={workspace.openMaintenanceBooking}>
          <Wrench data-icon="inline-start" aria-hidden="true" />
          Add maintenance
        </Button>
      }
    >
      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        <MaintenanceMetric
          icon={MonitorCog}
          label="Machine"
          value={workspace.selectedMachine?.name ?? "None"}
          detail={workspace.selectedMachine?.active ? "available" : "inactive"}
        />
        <MaintenanceMetric
          icon={Wrench}
          label="Service"
          value={formatBlockCount(maintenanceBookings.length)}
          detail={`${formatHours(maintenanceHours)} reserved`}
        />
        <MaintenanceMetric
          icon={Clock3}
          label="Next"
          value={nextMaintenance?.title ?? "Open"}
          detail={
            nextMaintenance
              ? `${formatDate(nextMaintenance.startsAt)} · ${formatTime(
                  nextMaintenance.startsAt,
                )} - ${formatTime(nextMaintenance.endsAt)}`
              : "No maintenance this week"
          }
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">Maintenance windows</h2>
          <Badge variant="outline">{formatBlockCount(maintenanceBookings.length)}</Badge>
        </div>
        {maintenanceBookings.length ? (
          <>
            <div className="divide-y divide-border lg:hidden">
              {maintenanceBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  className="w-full px-4 py-3 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => workspace.editBooking(booking)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{booking.title}</div>
                      <div className="mt-1 text-muted-foreground text-xs tabular-nums">
                        {formatDate(booking.startsAt)} {formatTime(booking.startsAt)} -{" "}
                        {formatDate(booking.endsAt)} {formatTime(booking.endsAt)}
                      </div>
                    </div>
                    <Pencil className="text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.title}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(booking.startsAt)} {formatTime(booking.startsAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(booking.endsAt)} {formatTime(booking.endsAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${booking.title}`}
                        onClick={() => workspace.editBooking(booking)}
                      >
                        <Pencil data-icon="inline-start" aria-hidden="true" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wrench aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No maintenance blocks</EmptyTitle>
              <EmptyDescription>
                Schedule service windows before taking a machine offline.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </AdminPageFrame>
  )
}

function MaintenanceMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return (
    <section className="bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="mt-1 truncate font-semibold text-lg">{value}</div>
          <div className="mt-0.5 truncate text-muted-foreground text-xs">{detail}</div>
        </div>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

function formatBlockCount(count: number) {
  return `${count} ${count === 1 ? "block" : "blocks"}`
}

function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}

function OverviewDetailRow({
  label,
  value,
  detail,
  badge,
  onClick,
}: {
  label: string
  value: string
  detail: string
  badge?: string
  onClick?: () => void
}) {
  const Comp = onClick ? "button" : "div"

  return (
    <Comp
      type={onClick ? "button" : undefined}
      className={cn(
        "grid w-full gap-2 px-4 py-3 text-left",
        onClick
          ? "transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : null,
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground text-xs">{label}</div>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 font-medium text-sm">{value}</div>
        <div className="mt-1 line-clamp-2 text-muted-foreground text-xs">{detail}</div>
      </div>
    </Comp>
  )
}

function SummaryPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}) {
  return (
    <section className="bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="font-semibold text-xl tabular-nums">{value}</div>
          <div className="text-muted-foreground text-xs">{detail}</div>
        </div>
        <div className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
