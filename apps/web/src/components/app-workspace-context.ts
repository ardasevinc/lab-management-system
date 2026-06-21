import { createContext, useContext } from "react"
import type { Booking, Machine, User } from "@/lib/api"
import type { CalendarRange } from "@/lib/calendar-geometry"

export type DashboardStats = {
  maintenanceCount: number
  todayBookings: number
  weekBookings: number
  weekHours: number
}

export type MachineUpdateValue = Pick<
  Machine,
  "accessNotes" | "active" | "description" | "name" | "specs"
>

export type MachineCreateValue = MachineUpdateValue & {
  slug?: string
}

export type WorkspaceContextValue = {
  user: User
  machines: Machine[]
  selectedMachine: Machine | null
  selectedMachineSlug: string
  weekRange: { start: string; end: string }
  bookings: Booking[]
  upcomingBookings: Booking[]
  users: User[]
  dashboardStats: DashboardStats
  pendingBookingId: string | null
  invitePending: boolean
  userAccessPendingId: string | null
  machineCreatePending: boolean
  machineUpdatePendingId: string | null
  machineDeletePendingId: string | null
  workspaceError: string | null
  adminSheetError: string | null
  setSelectedMachineSlug: (slug: string) => void
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToCurrentWeek: () => void
  goToWeek: (date: Date) => void
  clearWorkspaceError: () => void
  clearAdminSheetError: () => void
  openNewBooking: () => void
  openMaintenanceBooking: () => void
  inviteUser: (form: FormData, options?: { onSuccess?: () => void }) => void
  updateUserAccess: (user: User, value: { active?: boolean; role?: User["role"] }) => void
  updateMachine: (
    machine: Machine,
    value: MachineUpdateValue,
    options?: { onSuccess?: () => void },
  ) => void
  createMachine: (value: MachineCreateValue, options?: { onSuccess?: () => void }) => void
  deleteMachine: (machine: Machine, options?: { onSuccess?: () => void }) => void
  createRange: (range: CalendarRange) => void
  editBooking: (booking: Booking) => void
  moveBooking: (booking: Booking, range: CalendarRange) => void
  resizeBooking: (booking: Booking, range: CalendarRange) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error("useWorkspace must be used inside AppWorkspace.")
  }

  return context
}
