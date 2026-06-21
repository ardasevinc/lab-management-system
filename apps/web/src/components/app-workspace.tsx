import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Navigate, useLocation } from "@tanstack/react-router"
import { addWeeks, isSameDay } from "date-fns"
import { useEffect, useMemo, useState } from "react"
import { AppShell, WorkspaceBootstrap } from "@/components/app-shell"
import {
  type MachineCreateValue,
  type MachineUpdateValue,
  WorkspaceContext,
  type WorkspaceContextValue,
} from "@/components/app-workspace-context"
import { BookingDialog, type BookingDialogValue } from "@/components/booking-dialog"
import {
  type AuditEvent,
  apiFetch,
  type Booking,
  logout,
  type Machine,
  setStoredToken,
  type User,
} from "@/lib/api"
import { getRoundedOneHourRange } from "@/lib/booking-dialog-defaults"
import { resolveSelectedMachine, resolveSelectedMachineSlug } from "@/lib/machine-selection"
import { getWeekRange } from "@/lib/week-range"

type DialogState = {
  mode: "create" | "edit"
  booking: Booking | null
  range: { startsAt: string; endsAt: string } | null
  initialType: Booking["type"]
} | null

export function AppWorkspace() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [authVersion, setAuthVersion] = useState(0)
  const [selectedMachineSlug, setSelectedMachineSlug] = useState("tohum")
  const [visibleWeekDate, setVisibleWeekDate] = useState(() => new Date())
  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [adminSheetError, setAdminSheetError] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ["me", authVersion],
    queryFn: () => apiFetch<{ user: User }>("/auth/me"),
    retry: false,
  })

  const machinesQuery = useQuery({
    queryKey: ["machines"],
    queryFn: () => apiFetch<{ machines: Machine[] }>("/machines"),
    enabled: Boolean(meQuery.data),
  })

  const machines = machinesQuery.data?.machines ?? []
  const selectedMachine = useMemo(
    () => resolveSelectedMachine(machines, selectedMachineSlug),
    [machines, selectedMachineSlug],
  )
  const resolvedSelectedMachineSlug = useMemo(
    () => resolveSelectedMachineSlug(machines, selectedMachineSlug),
    [machines, selectedMachineSlug],
  )

  const weekRange = useMemo(() => getWeekRange(visibleWeekDate), [visibleWeekDate])
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

  useEffect(() => {
    if (resolvedSelectedMachineSlug !== selectedMachineSlug) {
      setSelectedMachineSlug(resolvedSelectedMachineSlug)
    }
  }, [resolvedSelectedMachineSlug, selectedMachineSlug])

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
          userId: value.userId,
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
          userId: value.userId,
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
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => {
      const params = new URLSearchParams()

      if (reason) {
        params.set("reason", reason)
      }

      const query = params.size ? `?${params.toString()}` : ""
      return apiFetch<{ ok: true }>(`/bookings/${id}${query}`, { method: "DELETE" })
    },
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
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const userAccessMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: { active?: boolean; role?: User["role"] } }) =>
      apiFetch<{ user: User }>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      }),
    onSuccess: () => {
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error: Error) => {
      setWorkspaceError(error.message)
    },
  })

  const machineUpdateMutation = useMutation({
    mutationFn: ({
      id,
      value,
      onSuccess,
    }: {
      id: string
      value: MachineUpdateValue
      onSuccess?: () => void
    }) =>
      apiFetch<{ machine: Machine }>(`/admin/machines/${id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      }).then(() => ({ onSuccess })),
    onSuccess: ({ onSuccess }) => {
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const machineCreateMutation = useMutation({
    mutationFn: ({ value, onSuccess }: { value: MachineCreateValue; onSuccess?: () => void }) =>
      apiFetch<{ machine: Machine }>("/admin/machines", {
        method: "POST",
        body: JSON.stringify(value),
      }).then(() => ({ onSuccess })),
    onSuccess: ({ onSuccess }) => {
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const machineDeleteMutation = useMutation({
    mutationFn: ({ machine, onSuccess }: { machine: Machine; onSuccess?: () => void }) =>
      apiFetch<{ machine: Machine }>(`/admin/machines/${machine.id}`, {
        method: "DELETE",
      }).then(() => ({ machine, onSuccess })),
    onSuccess: ({ machine, onSuccess }) => {
      const remainingMachines =
        machinesQuery.data?.machines.filter((candidate) => candidate.id !== machine.id) ?? []

      if (selectedMachineSlug === machine.slug && remainingMachines[0]) {
        setSelectedMachineSlug(remainingMachines[0].slug)
      }

      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  if (meQuery.isError) {
    setStoredToken(null)
    return <Navigate to="/login" search={{ redirect: location.href }} replace />
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
    machines,
    selectedMachine,
    selectedMachineSlug: resolvedSelectedMachineSlug,
    weekRange,
    bookings,
    upcomingBookings: getUpcomingBookings(bookings),
    users,
    dashboardStats: getDashboardStats(bookings),
    pendingBookingId: updateBookingMutation.variables?.id ?? null,
    invitePending: inviteMutation.isPending,
    userAccessPendingId: userAccessMutation.isPending ? userAccessMutation.variables.id : null,
    machineCreatePending: machineCreateMutation.isPending,
    machineUpdatePendingId: machineUpdateMutation.isPending
      ? machineUpdateMutation.variables.id
      : null,
    machineDeletePendingId: machineDeleteMutation.isPending
      ? machineDeleteMutation.variables.machine.id
      : null,
    workspaceError,
    adminSheetError,
    setSelectedMachineSlug,
    goToPreviousWeek: () => setVisibleWeekDate((date) => addWeeks(date, -1)),
    goToNextWeek: () => setVisibleWeekDate((date) => addWeeks(date, 1)),
    goToCurrentWeek: () => setVisibleWeekDate(new Date()),
    goToWeek: (date) => setVisibleWeekDate(date),
    clearWorkspaceError: () => setWorkspaceError(null),
    clearAdminSheetError: () => setAdminSheetError(null),
    openNewBooking: () => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "create", booking: null, range: null, initialType: "normal" })
    },
    openMaintenanceBooking: () => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({
        mode: "create",
        booking: null,
        initialType: "maintenance",
        range: getRoundedOneHourRange(),
      })
    },
    inviteUser: (form, options) => {
      setAdminSheetError(null)
      inviteMutation.mutate(form, { onSuccess: options?.onSuccess })
    },
    updateUserAccess: (targetUser, access) =>
      userAccessMutation.mutate({ id: targetUser.id, value: access }),
    updateMachine: (machine, machineUpdate, options) => {
      setAdminSheetError(null)
      machineUpdateMutation.mutate({
        id: machine.id,
        value: machineUpdate,
        onSuccess: options?.onSuccess,
      })
    },
    createMachine: (machineCreate, options) => {
      setAdminSheetError(null)
      machineCreateMutation.mutate({
        value: machineCreate,
        onSuccess: options?.onSuccess,
      })
    },
    deleteMachine: (machine, options) => {
      setAdminSheetError(null)
      machineDeleteMutation.mutate({
        machine,
        onSuccess: options?.onSuccess,
      })
    },
    createRange: (range) => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "create", booking: null, range, initialType: "normal" })
    },
    editBooking: (booking) => {
      setDialogError(null)
      setWorkspaceError(null)
      setDialogState({ mode: "edit", booking, range: null, initialType: booking.type })
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
        currentUser={user}
        users={users}
        isAdmin={user.role === "admin"}
        initialRange={dialogState?.range ?? null}
        initialType={dialogState?.initialType}
        pending={pending}
        error={dialogError}
        auditEvents={auditQuery.data?.events}
        auditLoading={auditQuery.isFetching}
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
        onDelete={(reason) => {
          if (dialogState?.booking) {
            deleteBookingMutation.mutate({ id: dialogState.booking.id, reason })
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
    userId: booking.userId,
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    reason: "",
  }
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
