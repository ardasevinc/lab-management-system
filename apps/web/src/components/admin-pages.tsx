import { Navigate } from "@tanstack/react-router"
import { CalendarDays, Clock3, type LucideIcon, MailPlus, MonitorCog, Wrench } from "lucide-react"
import { useWorkspace } from "@/components/app-workspace"
import { MachineInventory } from "@/components/machine-inventory"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatTime } from "@/lib/time"

export function AdminOverviewPage() {
  const workspace = useWorkspace()

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  const nextBooking = workspace.upcomingBookings[0]
  const activeMachines = workspace.machines.filter((machine) => machine.active).length
  const selectedMachine = workspace.selectedMachine

  return (
    <AdminPageFrame
      title="Admin overview"
      description="Bookings and access for the selected machine."
    >
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryPanel
          icon={MonitorCog}
          label="Machines"
          value={`${activeMachines}/${workspace.machines.length}`}
          detail="bookable"
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
          detail="blocks this week"
        />
      </div>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
            <div>
              <h2 className="font-medium text-sm">Operations</h2>
              <p className="text-muted-foreground text-xs">Current machine and queue.</p>
            </div>
            <Badge variant="outline">{workspace.users.length} users</Badge>
          </div>

          <div className="divide-y divide-border">
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)_auto]">
              <div className="text-muted-foreground text-sm">Machine</div>
              <div className="min-w-0">
                <div className="truncate font-medium">{selectedMachine?.name ?? "No machine"}</div>
                <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                  {selectedMachine?.description ?? "No selected machine."}
                </p>
                {selectedMachine?.specs.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedMachine.specs.map((spec) => (
                      <Badge key={spec} variant="outline">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
                {selectedMachine?.active ? "bookable" : "inactive"}
              </Badge>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)_auto]">
              <div className="text-muted-foreground text-sm">Next</div>
              {nextBooking ? (
                <>
                  <button
                    type="button"
                    className="min-w-0 text-left transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => workspace.editBooking(nextBooking)}
                  >
                    <div className="truncate font-medium">{nextBooking.title}</div>
                    <div className="mt-1 text-muted-foreground text-sm tabular-nums">
                      {formatDate(nextBooking.startsAt)} · {formatTime(nextBooking.startsAt)} -{" "}
                      {formatTime(nextBooking.endsAt)}
                    </div>
                  </button>
                  <Badge variant={nextBooking.type === "maintenance" ? "outline" : "secondary"}>
                    {nextBooking.type}
                  </Badge>
                </>
              ) : (
                <>
                  <div>
                    <div className="font-medium">No upcoming bookings</div>
                    <div className="mt-1 text-muted-foreground text-sm">
                      The selected week is open.
                    </div>
                  </div>
                  <Badge variant="outline">open</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-border border-b px-4 py-3">
            <h2 className="font-medium text-sm">Actions</h2>
          </div>
          <div className="grid gap-2 p-4">
            <Button type="button" className="justify-start" onClick={workspace.openNewBooking}>
              <Clock3 data-icon="inline-start" aria-hidden="true" />
              New booking
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={workspace.openMaintenanceBooking}
            >
              <Wrench data-icon="inline-start" aria-hidden="true" />
              Add maintenance
            </Button>
          </div>
        </div>
      </section>
    </AdminPageFrame>
  )
}

export function AdminUsersPage() {
  const workspace = useWorkspace()

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AdminPageFrame title="Users" description="Invite researchers and review access.">
      <section className="rounded-lg border border-border bg-card">
        <div className="border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">Invite user</h2>
        </div>
        <form
          className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            workspace.inviteUser(new FormData(event.currentTarget))
            event.currentTarget.reset()
          }}
        >
          <FieldGroup className="contents">
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
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
              <FieldLabel htmlFor="invite-name">Name</FieldLabel>
              <Input id="invite-name" name="name" placeholder="Researcher name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
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
          <Button type="submit" className="self-end" disabled={workspace.invitePending}>
            <MailPlus data-icon="inline-start" aria-hidden="true" />
            Invite
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">Members</h2>
          <Badge variant="outline">{workspace.users.length}</Badge>
        </div>
        <div className="divide-y divide-border md:hidden">
          {workspace.users.map((user) => (
            <div key={user.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{user.name}</div>
                  <div className="truncate text-muted-foreground text-xs">{user.email}</div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {user.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-28">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {user.role}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </AdminPageFrame>
  )
}

export function AdminMachinesPage() {
  const workspace = useWorkspace()

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AdminPageFrame title="Machines" description="Machine records and booking availability.">
      <MachineInventory machines={workspace.machines} />
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
      description="Blocking reservations for machine work."
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
            <div className="divide-y divide-border md:hidden">
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
            <Table className="hidden md:table">
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
              <EmptyDescription>
                Use maintenance blocks when admins need to reserve the machine.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </AdminPageFrame>
  )
}

function AdminPageFrame({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </main>
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
    <section className="rounded-lg border border-border bg-card px-4 py-3">
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
