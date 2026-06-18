import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Navigate } from "@tanstack/react-router"
import { addDays, isSameDay, startOfWeek } from "date-fns"
import { createContext, useContext, useMemo, useState } from "react"
import { AppShell, WorkspaceBootstrap } from "@/components/app-shell"
import { BookingDialog, type BookingDialogValue } from "@/components/booking-dialog"
import {
  type AuditEvent,
  apiFetch,
  type Booking,
  getStoredToken,
  logout,
  type Machine,
  setStoredToken,
  type User,
} from "@/lib/api"
import type { CalendarRange } from "@/lib/calendar-geometry"

export type DashboardStats = {
  maintenanceCount: number
  todayBookings: number
  weekBookings: number
  weekHours: number
}

type DialogState = {
  mode: "create" | "edit"
  booking: Booking | null
  range: { startsAt: string; endsAt: string } | null
} | null

type WorkspaceContextValue = {
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
  workspaceError: string | null
  setSelectedMachineSlug: (slug: string) => void
  clearWorkspaceError: () => void
  openNewBooking: () => void
  openMaintenanceBooking: () => void
  inviteUser: (form: FormData) => void
  createRange: (range: CalendarRange) => void
  editBooking: (booking: Booking) => void
  moveBooking: (booking: Booking, range: CalendarRange) => void
  resizeBooking: (booking: Booking, range: CalendarRange) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)

  if (!context) {
    throw new Error("useWorkspace must be used inside AppWorkspace.")
  }

  return context
}

export function AppWorkspace() {
  const queryClient = useQueryClient()
  const [authVersion, setAuthVersion] = useState(0)
  const [selectedMachineSlug, setSelectedMachineSlug] = useState("tohum")
  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const hasStoredToken = Boolean(getStoredToken())

  const meQuery = useQuery({
    queryKey: ["me", authVersion],
    queryFn: () => apiFetch<{ user: User }>("/auth/me"),
    retry: false,
    enabled: hasStoredToken,
  })

  const machinesQuery = useQuery({
    queryKey: ["machines"],
    queryFn: () => apiFetch<{ machines: Machine[] }>("/machines"),
    enabled: Boolean(meQuery.data),
  })

  const selectedMachine = useMemo(
    () =>
      machinesQuery.data?.machines.find((machine) => machine.slug === selectedMachineSlug) ?? null,
    [machinesQuery.data?.machines, selectedMachineSlug],
  )

  const [weekRange] = useState(() => getWeekRange(new Date()))
  const bookingsQuery = useQuery({
    queryKey: ["bookings", selectedMachine?.slug, weekRange.start, weekRange.end],
    queryFn: () =>
      apiFetch<{ bookings: Booking[] }>(
        `/machines/${selectedMachine?.slug}/bookings?start=${encodeURIComponent(
          weekRange.start,
        )}&end=${encodeURIComponent(weekRange.end)}`,
      ),
    enabled: Boolean(selectedMachine),
  })

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<{ users: User[] }>("/admin/users"),
    enabled: meQuery.data?.user.role === "admin",
  })

  const auditQuery = useQuery({
    queryKey: ["booking-audit", dialogState?.booking?.id],
    queryFn: () =>
      apiFetch<{ events: AuditEvent[] }>(`/bookings/${dialogState?.booking?.id}/audit`),
    enabled: meQuery.data?.user.role === "admin" && Boolean(dialogState?.booking),
  })

  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] })
  }

  const reportMutationError = (error: Error) => {
    if (dialogState) {
      setDialogError(error.message)
      return
    }

    setWorkspaceError(error.message)
  }

  const createBookingMutation = useMutation({
    mutationFn: (value: BookingDialogValue) =>
      apiFetch<{ booking: Booking }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          machineId: selectedMachine?.id,
          title: value.title,
          notes: value.notes || null,
          type: value.type,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          reason: value.reason || null,
        }),
      }),
    onSuccess: () => {
      setDialogState(null)
      setDialogError(null)
      setWorkspaceError(null)
      invalidateBookings()
    },
    onError: reportMutationError,
  })

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: BookingDialogValue }) =>
      apiFetch<{ booking: Booking }>(`/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: value.title,
          notes: value.notes || null,
          type: value.type,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          reason: value.reason || null,
        }),
      }),
    onSuccess: () => {
      setDialogState(null)
      setDialogError(null)
      setWorkspaceError(null)
      invalidateBookings()
    },
    onError: reportMutationError,
  })

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDialogState(null)
      setDialogError(null)
      setWorkspaceError(null)
      invalidateBookings()
    },
    onError: reportMutationError,
  })

  const inviteMutation = useMutation({
    mutationFn: (form: FormData) =>
      apiFetch<{ invite: User }>("/admin/invites", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          name: String(form.get("name") ?? ""),
          role: String(form.get("role") ?? "member"),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  if (!hasStoredToken) {
    return <Navigate to="/login" replace />
  }

  if (meQuery.isError) {
    setStoredToken(null)
    return <Navigate to="/login" replace />
  }

  if (!meQuery.data) {
    return <WorkspaceBootstrap />
  }

  const user = meQuery.data.user
  const workspaceIsBooting =
    queryIsBooting(machinesQuery) ||
    (Boolean(selectedMachine) && queryIsBooting(bookingsQuery)) ||
    (user.role === "admin" && queryIsBooting(usersQuery))

  if (workspaceIsBooting) {
    return <WorkspaceBootstrap />
  }

  const bookings = bookingsQuery.data?.bookings ?? []
  const users = usersQuery.data?.users ?? []
  const pending =
    createBookingMutation.isPending ||
    updateBookingMutation.isPending ||
    deleteBookingMutation.isPending

  const value: WorkspaceContextValue = {
    user,
    machines: machinesQuery.data?.machines ?? [],
    selectedMachine,
    selectedMachineSlug,
    weekRange,
    bookings,
    upcomingBookings: getUpcomingBookings(bookings),
    users,
    dashboardStats: getDashboardStats(bookings),
    pendingBookingId: updateBookingMutation.variables?.id ?? null,
    invitePending: inviteMutation.isPending,
    workspaceError,
    setSelectedMachineSlug,
    clearWorkspaceError: () => setWorkspaceError(null),
    openNewBooking: () => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "create", booking: null, range: null })
    },
    openMaintenanceBooking: () => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({
        mode: "create",
        booking: null,
        range: {
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        },
      })
    },
    inviteUser: (form) => inviteMutation.mutate(form),
    createRange: (range) => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "create", booking: null, range })
    },
    editBooking: (booking) => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "edit", booking, range: null })
    },
    moveBooking: (booking, range) => {
      setWorkspaceError(null)
      updateBookingMutation.mutate({
        id: booking.id,
        value: bookingToDialogValue(booking, range),
      })
    },
    resizeBooking: (booking, range) => {
      setWorkspaceError(null)
      updateBookingMutation.mutate({
        id: booking.id,
        value: bookingToDialogValue(booking, range),
      })
    },
  }

  return (
    <WorkspaceContext.Provider value={value}>
      <AppShell
        user={user}
        onLogout={() => {
          logout().finally(() => {
            queryClient.clear()
            setAuthVersion((version) => version + 1)
          })
        }}
      />

      <BookingDialog
        open={Boolean(dialogState)}
        mode={dialogState?.mode ?? "create"}
        booking={dialogState?.booking ?? null}
        machine={selectedMachine}
        isAdmin={user.role === "admin"}
        initialRange={dialogState?.range ?? null}
        pending={pending}
        error={dialogError}
        auditEvents={auditQuery.data?.events}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(null)
            setDialogError(null)
          }
        }}
        onSubmit={(formValue) => {
          if (dialogState?.mode === "edit" && dialogState.booking) {
            updateBookingMutation.mutate({ id: dialogState.booking.id, value: formValue })
            return
          }

          createBookingMutation.mutate(formValue)
        }}
        onDelete={() => {
          if (dialogState?.booking) {
            deleteBookingMutation.mutate(dialogState.booking.id)
          }
        }}
      />
    </WorkspaceContext.Provider>
  )
}

function queryIsBooting(query: { data: unknown; isPending: boolean; isError: boolean }) {
  return query.isPending && !query.data && !query.isError
}

function bookingToDialogValue(
  booking: Booking,
  range: { startsAt: string; endsAt: string },
): BookingDialogValue {
  return {
    title: booking.title,
    notes: booking.notes ?? "",
    type: booking.type,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    reason: "",
  }
}

function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  start.setHours(0, 0, 0, 0)
  const end = addDays(start, 7)

  return { start: start.toISOString(), end: end.toISOString() }
}

function getDashboardStats(bookings: Booking[]) {
  const now = new Date()
  const weekMinutes = bookings.reduce((total, booking) => {
    const startsAt = new Date(booking.startsAt).getTime()
    const endsAt = new Date(booking.endsAt).getTime()
    return total + Math.max(0, endsAt - startsAt) / 60_000
  }, 0)

  return {
    maintenanceCount: bookings.filter((booking) => booking.type === "maintenance").length,
    todayBookings: bookings.filter((booking) => isSameDay(new Date(booking.startsAt), now)).length,
    weekBookings: bookings.length,
    weekHours: Math.round(weekMinutes / 60),
  }
}

function getUpcomingBookings(bookings: Booking[]): Booking[] {
  const now = Date.now()
  return [...bookings]
    .filter((booking) => new Date(booking.endsAt).getTime() >= now)
    .sort((first, second) => {
      return new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    })
    .slice(0, 5)
}
