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

export type UserStats = {
  total: number
  active: number
  admins: number
  members: number
  disabled: number
}

export function getUserStats(users: User[]): UserStats {
  return users.reduce<UserStats>(
    (stats, user) => {
      stats.total += 1
      if (user.active) {
        stats.active += 1
      } else {
        stats.disabled += 1
      }
      if (user.role === "admin") {
        stats.admins += 1
      } else {
        stats.members += 1
      }
      return stats
    },
    { total: 0, active: 0, admins: 0, members: 0, disabled: 0 },
  )
}

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
