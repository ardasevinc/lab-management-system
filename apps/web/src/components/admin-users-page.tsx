import { Navigate } from "@tanstack/react-router"
import { MailPlus, Power, RotateCcw, UsersRound } from "lucide-react"
import { useState } from "react"
import { AdminPageFrame } from "@/components/admin-page-frame"
import { useWorkspace } from "@/components/app-workspace-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { useIsMobile } from "@/hooks/use-mobile"
import type { User } from "@/lib/api"

export function AdminUsersPage() {
  const workspace = useWorkspace()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [userFilter, setUserFilter] = useState("")

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  const activeUsers = workspace.users.filter((user) => user.active).length
  const filteredUsers = filterUsers(workspace.users, userFilter)
  const hasUserFilter = userFilter.trim().length > 0

  return (
    <AdminPageFrame
      title="Users"
      description="Roles and access"
      action={
        <Button type="button" onClick={() => setInviteOpen(true)}>
          <MailPlus data-icon="inline-start" aria-hidden="true" />
          Invite user
        </Button>
      }
    >
      <section className="rounded-lg border border-border bg-card">
        <div className="border-border border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-sm">Members</h2>
            <Badge variant="outline">
              {activeUsers}/{workspace.users.length} active
            </Badge>
          </div>
          {workspace.users.length ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Field className="max-w-sm gap-1.5">
                <FieldLabel htmlFor="user-filter" className="sr-only">
                  Filter users
                </FieldLabel>
                <Input
                  id="user-filter"
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  placeholder="Filter by name, email, role, status"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-muted-foreground text-xs">
                  {filteredUsers.length}/{workspace.users.length} shown
                </span>
                {hasUserFilter && filteredUsers.length ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUserFilter("")}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {workspace.users.length ? (
          filteredUsers.length ? (
            <>
              <div className="divide-y divide-border lg:hidden">
                {filteredUsers.map((user) => (
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
              <Table className="hidden lg:table">
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
                  {filteredUsers.map((user) => (
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
                          onToggle={() =>
                            workspace.updateUserAccess(user, { active: !user.active })
                          }
                        />
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
                  <UsersRound aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No matching users</EmptyTitle>
                <EmptyDescription>Try a name, email, role, or access status.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" variant="outline" onClick={() => setUserFilter("")}>
                  Clear filter
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No members yet</EmptyTitle>
              <EmptyDescription>
                Invite the first researcher before opening bookings.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setInviteOpen(true)}>
                <MailPlus data-icon="inline-start" aria-hidden="true" />
                Invite user
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
      <InviteUserSheet
        open={inviteOpen}
        pending={workspace.invitePending}
        error={workspace.adminSheetError}
        onOpenChange={(open) => {
          if (!open) {
            workspace.clearAdminSheetError()
          }
          setInviteOpen(open)
        }}
        onSubmit={(form) => {
          workspace.inviteUser(form, { onSuccess: () => setInviteOpen(false) })
        }}
      />
    </AdminPageFrame>
  )
}

function filterUsers(users: User[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase()
  if (!normalizedFilter) {
    return users
  }

  return users.filter((user) => {
    const searchable = [user.name, user.email, user.role, user.active ? "active" : "disabled"].join(
      " ",
    )

    return searchable.toLowerCase().includes(normalizedFilter)
  })
}

function InviteUserSheet({
  open,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (form: FormData) => void
}) {
  const isMobile = useIsMobile()
  const [pendingAdminInvite, setPendingAdminInvite] = useState<{
    form: FormData
    name: string
    email: string
  } | null>(null)

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPendingAdminInvite(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="overflow-y-auto p-4 data-[side=bottom]:max-h-[calc(100dvh-1rem)] data-[side=bottom]:rounded-t-xl data-[side=right]:w-full sm:max-w-md sm:p-5"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const role = String(form.get("role") ?? "member")
            if (role === "admin") {
              setPendingAdminInvite({
                form,
                name: String(form.get("name") ?? "this user"),
                email: String(form.get("email") ?? "their email"),
              })
              return
            }
            onSubmit(form)
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>Invite user</SheetTitle>
            <SheetDescription className="sr-only">
              Invite a lab member and assign their access role.
            </SheetDescription>
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
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <SheetFooter className="mt-0 px-0 pb-0">
            <Button type="submit" disabled={pending}>
              <MailPlus data-icon="inline-start" aria-hidden="true" />
              {pending ? "Inviting" : "Send invite"}
            </Button>
          </SheetFooter>
        </form>
        <AlertDialog
          open={pendingAdminInvite !== null}
          onOpenChange={(nextOpen) => !nextOpen && setPendingAdminInvite(null)}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Invite admin?</AlertDialogTitle>
              <AlertDialogDescription>
                This will invite {pendingAdminInvite?.name ?? "this user"} with admin access for{" "}
                {pendingAdminInvite?.email ?? "their email"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending || pendingAdminInvite === null}
                onClick={() => {
                  if (pendingAdminInvite) {
                    onSubmit(pendingAdminInvite.form)
                    setPendingAdminInvite(null)
                  }
                }}
              >
                Send admin invite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  const [pendingRole, setPendingRole] = useState<User["role"] | null>(null)
  const nextRoleLabel = pendingRole === "admin" ? "Admin" : "Member"
  const nextRoleArticle = pendingRole === "admin" ? "an" : "a"

  return (
    <>
      <Select
        value={user.role}
        disabled={isSelf || pending}
        onValueChange={(role) => {
          const nextRole = role as User["role"]
          if (nextRole !== user.role) {
            setPendingRole(nextRole)
          }
        }}
      >
        <SelectTrigger className="h-8 w-[116px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(open) => !open && setPendingRole(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will make {user.name} {nextRoleArticle} {nextRoleLabel.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || pendingRole === null}
              onClick={() => {
                if (pendingRole) {
                  onChange(pendingRole)
                  setPendingRole(null)
                }
              }}
            >
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={isSelf || pending}
      onClick={user.active ? undefined : onToggle}
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      {pending ? "Saving" : user.active ? "Disable" : "Reactivate"}
    </Button>
  )

  if (!user.active) {
    return button
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Disable user?</AlertDialogTitle>
          <AlertDialogDescription>
            This signs {user.name} out and blocks future login until an admin reactivates access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={onToggle}>
            Disable user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
