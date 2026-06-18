import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { addDays, isSameDay, startOfWeek } from "date-fns"
import { useMemo, useState } from "react"
import { AuthScreen } from "@/components/auth-screen"
import { BookingDialog, type BookingDialogValue } from "@/components/booking-dialog"
import { DashboardShell } from "@/components/dashboard-shell"
import {
  type AuditEvent,
  apiFetch,
  type Booking,
  getStoredToken,
  logout,
  type Machine,
  type User,
} from "@/lib/api"

export function App() {
  const queryClient = useQueryClient()
  const [authVersion, setAuthVersion] = useState(0)
  const [selectedMachineSlug, setSelectedMachineSlug] = useState("tohum")
  const [dialogState, setDialogState] = useState<{
    mode: "create" | "edit"
    booking: Booking | null
    range: { startsAt: string; endsAt: string } | null
  } | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ["me", authVersion],
    queryFn: () =>
      apiFetch<{ user: { id: string; email: string; name: string; role: "admin" | "member" } }>(
        "/auth/me",
      ),
    retry: false,
    enabled: Boolean(getStoredToken()),
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

  const weekRange = useMemo(() => getWeekRange(new Date()), [])
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

  const auditQuery = useQuery({
    queryKey: ["booking-audit", dialogState?.booking?.id],
    queryFn: () =>
      apiFetch<{ events: AuditEvent[] }>(`/bookings/${dialogState?.booking?.id}/audit`),
    enabled: userCanViewAudit(meQuery.data?.user) && Boolean(dialogState?.booking),
  })

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<{ users: User[] }>("/admin/users"),
    enabled: meQuery.data?.user.role === "admin",
  })

  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] })
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
      invalidateBookings()
    },
    onError: (error) => setDialogError(error.message),
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
      invalidateBookings()
    },
    onError: (error) => setDialogError(error.message),
  })

  const deleteBookingMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDialogState(null)
      setDialogError(null)
      invalidateBookings()
    },
    onError: (error) => setDialogError(error.message),
  })

  const inviteMutation = useMutation({
    mutationFn: (form: FormData) =>
      apiFetch<{ invite: { id: string; email: string; name: string; role: "admin" | "member" } }>(
        "/admin/invites",
        {
          method: "POST",
          body: JSON.stringify({
            email: String(form.get("email") ?? ""),
            name: String(form.get("name") ?? ""),
            role: String(form.get("role") ?? "member"),
          }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
  })

  if (!meQuery.data) {
    return (
      <AuthScreen
        onLoggedIn={() => {
          setAuthVersion((version) => version + 1)
          queryClient.invalidateQueries({ queryKey: ["me"] })
        }}
      />
    )
  }

  const user = meQuery.data.user
  const bookings = bookingsQuery.data?.bookings ?? []
  const users = usersQuery.data?.users ?? []
  const dashboardStats = getDashboardStats(bookings)
  const upcomingBookings = getUpcomingBookings(bookings)
  const pending =
    createBookingMutation.isPending ||
    updateBookingMutation.isPending ||
    deleteBookingMutation.isPending

  return (
    <>
      <DashboardShell
        user={user}
        machines={machinesQuery.data?.machines ?? []}
        selectedMachine={selectedMachine}
        selectedMachineSlug={selectedMachineSlug}
        weekRange={weekRange}
        bookings={bookings}
        upcomingBookings={upcomingBookings}
        users={users}
        dashboardStats={dashboardStats}
        pendingBookingId={updateBookingMutation.variables?.id ?? null}
        invitePending={inviteMutation.isPending}
        onSelectMachine={setSelectedMachineSlug}
        onLogout={() => {
          logout().finally(() => {
            queryClient.clear()
            window.location.reload()
          })
        }}
        onNewBooking={() => {
          setDialogError(null)
          setDialogState({ mode: "create", booking: null, range: null })
        }}
        onAddMaintenance={() => {
          setDialogError(null)
          setDialogState({
            mode: "create",
            booking: null,
            range: {
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
            },
          })
        }}
        onInvite={(form) => inviteMutation.mutate(form)}
        onCreateRange={(range) => {
          setDialogError(null)
          setDialogState({ mode: "create", booking: null, range })
        }}
        onEditBooking={(booking) => {
          setDialogError(null)
          setDialogState({ mode: "edit", booking, range: null })
        }}
        onMoveBooking={(booking, range) => {
          updateBookingMutation.mutate({
            id: booking.id,
            value: bookingToDialogValue(booking, range),
          })
        }}
        onResizeBooking={(booking, range) => {
          updateBookingMutation.mutate({
            id: booking.id,
            value: bookingToDialogValue(booking, range),
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
        onSubmit={(value) => {
          if (dialogState?.mode === "edit" && dialogState.booking) {
            updateBookingMutation.mutate({ id: dialogState.booking.id, value })
            return
          }
          createBookingMutation.mutate(value)
        }}
        onDelete={() => {
          if (dialogState?.booking) {
            deleteBookingMutation.mutate(dialogState.booking.id)
          }
        }}
      />
    </>
  )
}

function userCanViewAudit(user?: User) {
  return user?.role === "admin"
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
