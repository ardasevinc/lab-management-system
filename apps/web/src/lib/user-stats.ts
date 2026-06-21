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
