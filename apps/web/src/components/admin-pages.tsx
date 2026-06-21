import { Navigate } from "@tanstack/react-router"
import { CalendarDays, Clock3, type LucideIcon, MonitorCog, Wrench } from "lucide-react"
import { AdminPageFrame } from "@/components/admin-page-frame"
import { useWorkspace } from "@/components/app-workspace-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
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
  const accessValue = selectedMachine?.accessNotes ? "Configured" : "Not configured"
  const accessDetail = selectedMachine?.accessNotes ? "Admin-only access notes" : "No access notes"

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
              {selectedMachine?.description ?? "Select a machine before accepting bookings."}
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

  const maintenanceBookings = workspace.bookings.filter((booking) => booking.type === "maintenance")

  return (
    <AdminPageFrame
      title="Maintenance"
      description="Service windows"
      action={
        <Button type="button" onClick={workspace.openMaintenanceBooking}>
          <Wrench data-icon="inline-start" aria-hidden="true" />
          Add maintenance
        </Button>
      }
    >
      <section className="rounded-lg border border-border bg-card">
        <div className="border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">This week</h2>
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
                  <div className="truncate font-medium text-sm">{booking.title}</div>
                  <div className="mt-1 text-muted-foreground text-xs tabular-nums">
                    {formatDate(booking.startsAt)} {formatTime(booking.startsAt)} -{" "}
                    {formatDate(booking.endsAt)} {formatTime(booking.endsAt)}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceBookings.map((booking) => (
                  <TableRow key={booking.id} onClick={() => workspace.editBooking(booking)}>
                    <TableCell className="font-medium">{booking.title}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(booking.startsAt)} {formatTime(booking.startsAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(booking.endsAt)} {formatTime(booking.endsAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <Empty className="items-start justify-start p-4 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>No maintenance blocks</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </AdminPageFrame>
  )
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
