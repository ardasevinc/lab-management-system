import { Power, RotateCcw } from "lucide-react"
import { useState } from "react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@/lib/api"
import type { UserStats } from "@/lib/user-stats"

export function UserStatsStrip({ stats }: { stats: UserStats }) {
  const items = [
    { label: "Total", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Admins", value: stats.admins },
    { label: "Members", value: stats.members },
    { label: "Disabled", value: stats.disabled },
  ]

  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 border-border border-t pt-3 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="font-medium text-sm tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function UserStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "secondary" : "outline"}>{active ? "active" : "disabled"}</Badge>
}

export function UserIdentity({ user, showEmail = true }: { user: User; showEmail?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{userInitials(user)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{user.name}</div>
        {showEmail ? (
          <div className="truncate text-muted-foreground text-xs">{user.email}</div>
        ) : null}
      </div>
    </div>
  )
}

export function UserRoleSelect({
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

function userInitials(user: User) {
  const source = user.name.trim() || user.email
  const words = source
    .split(/[\s@._-]+/)
    .map((word) => word.trim())
    .filter(Boolean)

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

export function UserAccessButton({
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
