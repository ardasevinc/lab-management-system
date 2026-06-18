import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { addDays, isSameDay, startOfWeek } from "date-fns"
import { useMemo, useState } from "react"
import { AuthScreen } from "@/components/auth-screen"
import { BookingDialog, type BookingDialogValue } from "@/components/booking-dialog"
import { DashboardShell } from "@/components/dashboard-shell"
import { Skeleton } from "@/components/ui/skeleton"
import {
  type AuditEvent,
  apiFetch,
  type Booking,
  getStoredToken,
  logout,
  type Machine,
  type User,
} from "@/lib/api"

const calendarSkeletonCells = Array.from({ length: 72 }, (_, index) => `calendar-cell-${index}`)

export function App() {
  const queryClient = useQueryClient()
  const [authVersion, setAuthVersion] = useState(0)
  const hasStoredToken = Boolean(getStoredToken())
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

  if (hasStoredToken && !meQuery.data && !meQuery.isError) {
    return <AppBootstrap />
  }

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
  const workspaceIsBooting =
    queryIsBooting(machinesQuery) ||
    (Boolean(selectedMachine) && queryIsBooting(bookingsQuery)) ||
    (user.role === "admin" && queryIsBooting(usersQuery))

  if (workspaceIsBooting) {
    return <AppBootstrap />
  }

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
            setAuthVersion((version) => version + 1)
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

function AppBootstrap() {
  return (
    <main className="min-h-screen bg-background text-foreground" aria-label="Loading workspace">
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-border border-b bg-background/94 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <div className="size-4 rounded-sm border-2 border-primary-foreground/80" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16 sm:w-40" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </header>

        <div className="grid flex-1 xl:grid-cols-[232px_minmax(0,1fr)_304px]">
          <aside className="border-border border-b bg-sidebar/70 p-3 sm:p-4 xl:border-r xl:border-b-0">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-6 rounded-full" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Skeleton className="h-[74px] rounded-md" />
            </div>
            <div className="my-4 h-px bg-border" />
            <div className="grid gap-3 px-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </aside>

          <section className="min-w-0 bg-background p-3 sm:p-4">
            <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-7 w-44" />
                  <Skeleton className="h-6 w-44 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-4 w-64 max-w-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[520px]">
                {["week", "today", "booked", "maintenance"].map((item) => (
                  <Skeleton key={item} className="h-[72px] rounded-md" />
                ))}
              </div>
            </div>

            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex min-h-11 items-center justify-between border-border border-b bg-muted/40 px-3 py-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="calendar-frame h-[620px]">
                <div className="grid h-full grid-cols-[52px_repeat(7,minmax(96px,1fr))] grid-rows-[36px_repeat(8,56px)] overflow-hidden">
                  {calendarSkeletonCells.map((cell) => (
                    <div key={cell} className="border-border border-r border-b" />
                  ))}
                </div>
              </div>
            </section>
          </section>

          <aside className="border-border border-t bg-sidebar/70 p-3 sm:p-4 xl:border-t-0 xl:border-l">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function userCanViewAudit(user?: User) {
  return user?.role === "admin"
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
