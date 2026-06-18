import { Navigate } from "@tanstack/react-router"
import { Clock3, MailPlus, MonitorCog, type ShieldCheck, UsersRound, Wrench } from "lucide-react"
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
      description="Operational state for bookings, users, and machines."
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryPanel
          icon={MonitorCog}
          label="Machines"
          value={`${activeMachines}/${workspace.machines.length}`}
          detail="bookable"
        />
        <SummaryPanel
          icon={UsersRound}
          label="Users"
          value={String(workspace.users.length)}
          detail="invited accounts"
        />
        <SummaryPanel
          icon={Wrench}
          label="Maintenance"
          value={String(workspace.dashboardStats.maintenanceCount)}
          detail="blocks this week"
        />
      </div>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-border border-b px-4 py-3">
            <h2 className="font-medium text-sm">Machine status</h2>
          </div>
          <div className="grid gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{selectedMachine?.name ?? "No machine"}</div>
                <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                  {selectedMachine?.description ?? "No selected machine."}
                </p>
              </div>
              <Badge variant={selectedMachine?.active ? "secondary" : "outline"}>
                {selectedMachine?.active ? "bookable" : "inactive"}
              </Badge>
            </div>
            {selectedMachine?.specs.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedMachine.specs.map((spec) => (
                  <Badge key={spec} variant="outline">
                    {spec}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-border border-b px-4 py-3">
            <h2 className="font-medium text-sm">Quick actions</h2>
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

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
          <div>
            <h2 className="font-medium text-sm">Next booking</h2>
            <p className="text-muted-foreground text-xs">Current schedule priority.</p>
          </div>
          <Clock3 className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="p-4">
          {nextBooking ? (
            <button
              type="button"
              className="w-full rounded-md border border-border bg-muted/25 px-3 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => workspace.editBooking(nextBooking)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{nextBooking.title}</span>
                <Badge variant={nextBooking.type === "maintenance" ? "outline" : "secondary"}>
                  {nextBooking.type}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground text-sm tabular-nums">
                {formatDate(nextBooking.startsAt)} · {formatTime(nextBooking.startsAt)} -{" "}
                {formatTime(nextBooking.endsAt)}
              </div>
            </button>
          ) : (
            <Empty className="items-start py-2 text-left">
              <EmptyHeader>
                <EmptyTitle>No upcoming bookings</EmptyTitle>
                <EmptyDescription>The selected week is open.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
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
        <div className="border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">Members</h2>
        </div>
        <div className="grid gap-2 p-3 md:hidden">
          {workspace.users.map((user) => (
            <div key={user.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
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
    <AdminPageFrame title="Maintenance" description="Blocking reservations for machine work.">
      <div className="flex justify-end">
        <Button type="button" onClick={workspace.openMaintenanceBooking}>
          <Wrench data-icon="inline-start" aria-hidden="true" />
          Add maintenance
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">This week</h2>
        </div>
        {maintenanceBookings.length ? (
          <>
            <div className="grid gap-2 p-3 md:hidden">
              {maintenanceBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  className="rounded-md border border-border bg-muted/20 px-3 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Empty className="items-start p-4 text-left">
            <EmptyHeader>
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
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
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
  icon: typeof ShieldCheck
  label: string
  value: string
  detail: string
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="font-semibold text-2xl tabular-nums">{value}</div>
          <div className="text-muted-foreground text-xs">{detail}</div>
        </div>
        <div className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
