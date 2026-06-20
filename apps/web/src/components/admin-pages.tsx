import { Navigate } from "@tanstack/react-router"
import {
  CalendarDays,
  Clock3,
  type LucideIcon,
  MailPlus,
  MonitorCog,
  Plus,
  Power,
  RotateCcw,
  Save,
  Trash2,
  Wrench,
} from "lucide-react"
import { useState } from "react"
import {
  type MachineCreateValue,
  type MachineUpdateValue,
  useWorkspace,
} from "@/components/app-workspace"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { Machine, User } from "@/lib/api"
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
  const machineAvailability = selectedMachine?.active ? "Active for reservations" : "Inactive"
  const accessDetail = selectedMachine?.accessNotes
    ? "Visible to admins only"
    : "No private access notes saved"

  return (
    <AdminPageFrame
      title="Admin overview"
      description="Bookings and access for the selected machine."
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
                {selectedMachine?.active ? "bookable" : "inactive"}
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
                <EmptyDescription>This machine is free for the selected week.</EmptyDescription>
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
              value={nextBooking?.title ?? "No upcoming booking"}
              detail={
                nextBooking
                  ? `${formatDate(nextBooking.startsAt)} · ${formatTime(nextBooking.startsAt)} - ${formatTime(nextBooking.endsAt)}`
                  : "The upcoming slot is open."
              }
              badge={nextBooking?.type ?? "open"}
              onClick={nextBooking ? () => workspace.editBooking(nextBooking) : undefined}
            />
            <OverviewDetailRow
              label="Specs"
              value={selectedMachine?.specs[0] ?? "No primary spec"}
              detail={secondarySpecs || machineAvailability}
            />
            <OverviewDetailRow
              label="Access"
              value={selectedMachine?.accessNotes || "Not configured"}
              detail={accessDetail}
            />
          </div>
        </div>
      </section>
    </AdminPageFrame>
  )
}

export function AdminUsersPage() {
  const workspace = useWorkspace()
  const [inviteOpen, setInviteOpen] = useState(false)

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  const activeUsers = workspace.users.filter((user) => user.active).length

  return (
    <AdminPageFrame
      title="Users"
      description="Members and access."
      action={
        <Button type="button" onClick={() => setInviteOpen(true)}>
          <MailPlus data-icon="inline-start" aria-hidden="true" />
          Invite user
        </Button>
      }
    >
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
          <h2 className="font-medium text-sm">Members</h2>
          <Badge variant="outline">
            {activeUsers}/{workspace.users.length} active
          </Badge>
        </div>
        <div className="divide-y divide-border md:hidden">
          {workspace.users.map((user) => (
            <div key={user.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{user.name}</div>
                  <div className="truncate text-muted-foreground text-xs">{user.email}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <UserRoleSelect
                    user={user}
                    currentUserId={workspace.user.id}
                    pending={workspace.userAccessPendingId === user.id}
                    onChange={(role) => workspace.updateUserAccess(user, { role })}
                  />
                  <UserStatusBadge active={user.active} />
                </div>
              </div>
              <UserAccessButton
                className="mt-3 w-full"
                user={user}
                currentUserId={workspace.user.id}
                pending={workspace.userAccessPendingId === user.id}
                onToggle={() => workspace.updateUserAccess(user, { active: !user.active })}
              />
            </div>
          ))}
        </div>
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-28">Role</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-36 text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <UserRoleSelect
                    user={user}
                    currentUserId={workspace.user.id}
                    pending={workspace.userAccessPendingId === user.id}
                    onChange={(role) => workspace.updateUserAccess(user, { role })}
                  />
                </TableCell>
                <TableCell>
                  <UserStatusBadge active={user.active} />
                </TableCell>
                <TableCell className="text-right">
                  <UserAccessButton
                    user={user}
                    currentUserId={workspace.user.id}
                    pending={workspace.userAccessPendingId === user.id}
                    onToggle={() => workspace.updateUserAccess(user, { active: !user.active })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <InviteUserSheet
        open={inviteOpen}
        pending={workspace.invitePending}
        onOpenChange={setInviteOpen}
        onSubmit={(form) => {
          workspace.inviteUser(form, { onSuccess: () => setInviteOpen(false) })
        }}
      />
    </AdminPageFrame>
  )
}

function InviteUserSheet({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (form: FormData) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-4 data-[side=right]:w-full sm:max-w-md sm:p-5">
        <form
          className="flex min-h-full flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(new FormData(event.currentTarget))
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>Invite user</SheetTitle>
          </SheetHeader>

          <FieldGroup>
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

          <SheetFooter className="px-0 pb-0">
            <Button type="submit" disabled={pending}>
              <MailPlus data-icon="inline-start" aria-hidden="true" />
              {pending ? "Inviting" : "Send invite"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function UserStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "secondary" : "outline"}>{active ? "active" : "disabled"}</Badge>
}

function UserRoleSelect({
  user,
  currentUserId,
  pending,
  onChange,
}: {
  user: User
  currentUserId: string
  pending: boolean
  onChange: (role: User["role"]) => void
}) {
  const isSelf = user.id === currentUserId

  return (
    <Select
      value={user.role}
      disabled={isSelf || pending}
      onValueChange={(role) => onChange(role as User["role"])}
    >
      <SelectTrigger className="h-8 w-[116px] capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function UserAccessButton({
  user,
  currentUserId,
  pending,
  className,
  onToggle,
}: {
  user: User
  currentUserId: string
  pending: boolean
  className?: string
  onToggle: () => void
}) {
  const isSelf = user.id === currentUserId
  const Icon = user.active ? Power : RotateCcw

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isSelf || pending}
      onClick={onToggle}
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      {pending ? "Saving" : user.active ? "Disable" : "Reactivate"}
    </Button>
  )
}

export function AdminMachinesPage() {
  const workspace = useWorkspace()
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [creatingMachine, setCreatingMachine] = useState(false)

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AdminPageFrame
      title="Machines"
      description="Machine records and booking availability."
      action={
        <Button type="button" onClick={() => setCreatingMachine(true)}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New machine
        </Button>
      }
    >
      <MachineInventory machines={workspace.machines} onEditMachine={setEditingMachine} />
      <MachineEditorSheet
        mode="edit"
        machine={editingMachine}
        open={Boolean(editingMachine)}
        pending={
          workspace.machineUpdatePendingId === editingMachine?.id ||
          workspace.machineDeletePendingId === editingMachine?.id
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditingMachine(null)
          }
        }}
        onSubmit={(value) => {
          if (!editingMachine) {
            return
          }

          workspace.updateMachine(editingMachine, value, {
            onSuccess: () => setEditingMachine(null),
          })
        }}
        onDelete={() => {
          if (!editingMachine) {
            return
          }

          workspace.deleteMachine(editingMachine, {
            onSuccess: () => setEditingMachine(null),
          })
        }}
      />
      <MachineEditorSheet
        mode="create"
        machine={null}
        open={creatingMachine}
        pending={workspace.machineCreatePending}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingMachine(false)
          }
        }}
        onSubmit={(value) => {
          workspace.createMachine(value, {
            onSuccess: () => setCreatingMachine(false),
          })
        }}
      />
    </AdminPageFrame>
  )
}

function MachineEditorSheet({
  mode,
  machine,
  open,
  pending,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit"
  machine: Machine | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (value: MachineCreateValue | MachineUpdateValue) => void
  onDelete?: () => void
}) {
  if (mode === "edit" && !machine) {
    return null
  }

  const defaults = machine ?? {
    id: "new",
    slug: "",
    name: "",
    description: "",
    specs: [],
    accessNotes: "",
    active: true,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-4 data-[side=right]:w-full sm:max-w-lg sm:p-5">
        <form
          key={`${mode}-${defaults.id}`}
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const value = {
              name: String(form.get("name") ?? "").trim(),
              slug:
                mode === "create" ? String(form.get("slug") ?? "").trim() || undefined : undefined,
              description: String(form.get("description") ?? "").trim(),
              specs: parseMachineSpecs(String(form.get("specs") ?? "")),
              accessNotes: String(form.get("accessNotes") ?? "").trim(),
              active: form.get("active") === "true",
            }

            if (mode === "edit") {
              const { slug: _slug, ...updateValue } = value
              onSubmit(updateValue)
              return
            }

            onSubmit(value)
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{mode === "create" ? "New machine" : "Edit machine"}</SheetTitle>
            <SheetDescription>
              {mode === "create" ? "Add a bookable lab resource." : defaults.slug}
            </SheetDescription>
          </SheetHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="machine-name">Name</FieldLabel>
              <Input id="machine-name" name="name" defaultValue={defaults.name} required />
            </Field>
            {mode === "create" ? (
              <Field>
                <FieldLabel htmlFor="machine-slug">Slug</FieldLabel>
                <Input
                  id="machine-slug"
                  name="slug"
                  defaultValue={defaults.slug}
                  placeholder="gpu-2"
                  spellCheck={false}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="machine-state">Booking state</FieldLabel>
              <Select name="active" defaultValue={String(defaults.active)}>
                <SelectTrigger id="machine-state" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="true">Bookable</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-description">Description</FieldLabel>
              <Textarea
                id="machine-description"
                name="description"
                defaultValue={defaults.description}
                rows={4}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-specs">Specs</FieldLabel>
              <Textarea
                id="machine-specs"
                name="specs"
                defaultValue={defaults.specs.join("\n")}
                rows={5}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-access-notes">Access notes</FieldLabel>
              <Textarea
                id="machine-access-notes"
                name="accessNotes"
                defaultValue={defaults.accessNotes}
                rows={4}
              />
            </Field>
          </FieldGroup>

          <SheetFooter className="gap-2 px-0 pb-0 sm:flex-row sm:items-center sm:justify-between">
            {mode === "edit" && onDelete ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onDelete}>
                <Trash2 data-icon="inline-start" aria-hidden="true" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              <Save data-icon="inline-start" aria-hidden="true" />
              {pending ? "Saving" : mode === "create" ? "Create machine" : "Save machine"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function parseMachineSpecs(value: string) {
  return value
    .split(/\n|,/)
    .map((spec) => spec.trim())
    .filter(Boolean)
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
      <div
        className={cn(
          "flex items-center justify-end gap-3 sm:mb-4 sm:items-end sm:justify-between",
          action ? "mb-3" : "mb-0",
        )}
      >
        <div className="sr-only sm:not-sr-only">
          <h1 className="font-semibold text-xl tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 hidden text-muted-foreground text-sm sm:block">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </main>
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
