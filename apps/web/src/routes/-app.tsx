import { labConfig } from "@lab/config"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Cpu, LogOut, ShieldCheck, UserRound } from "lucide-react"
import { useMemo, useState } from "react"
import { BookingDialog, type BookingDialogValue } from "@/components/booking-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { WeekCalendar } from "@/components/week-calendar"
import {
  type AuditEvent,
  apiFetch,
  type Booking,
  getStoredToken,
  logout,
  type Machine,
  requestOtp,
  type User,
  verifyOtp,
} from "@/lib/api"
import { formatDate } from "@/lib/time"

export function App() {
  const queryClient = useQueryClient()
  const [selectedMachineSlug, setSelectedMachineSlug] = useState("tohum")
  const [dialogState, setDialogState] = useState<{
    mode: "create" | "edit"
    booking: Booking | null
    range: { startsAt: string; endsAt: string } | null
  } | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ["me"],
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
    return <LoginScreen onLoggedIn={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />
  }

  const user = meQuery.data.user
  const bookings = bookingsQuery.data?.bookings ?? []
  const pending =
    createBookingMutation.isPending ||
    updateBookingMutation.isPending ||
    deleteBookingMutation.isPending

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-border border-b pb-6">
          <div>
            <p className="text-muted-foreground text-sm">{labConfig.shortName}</p>
            <h1 className="font-semibold text-3xl tracking-tight">{labConfig.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <UserRound className="size-3" />
              {user.name}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                logout().finally(() => {
                  queryClient.clear()
                  window.location.reload()
                })
              }}
            >
              <LogOut className="size-4" />
              Log out
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDialogError(null)
                setDialogState({ mode: "create", booking: null, range: null })
              }}
            >
              <CalendarDays className="size-4" />
              New booking
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <Cpu className="size-4 text-primary" />
                Machines
              </div>
              <div className="space-y-2">
                {machinesQuery.data?.machines.map((machine) => (
                  <button
                    key={machine.id}
                    type="button"
                    className="w-full rounded-md border border-border bg-muted/40 p-3 text-left transition hover:bg-muted"
                    data-active={machine.slug === selectedMachineSlug}
                    onClick={() => setSelectedMachineSlug(machine.slug)}
                  >
                    <div className="font-medium">{machine.name}</div>
                    <p className="mt-1 text-muted-foreground text-sm">{machine.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4 text-primary" />
                Access
              </div>
              <p className="text-muted-foreground text-sm">
                Invite-only booking portal. Admins can edit maintenance windows and resolve
                conflicts.
              </p>
              <Separator className="my-3" />
              <p className="text-muted-foreground text-sm">
                Signed in as <span className="font-medium text-foreground">{user.role}</span>.
              </p>
            </section>

            {user.role === "admin" ? (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 font-medium">Admin</div>
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    inviteMutation.mutate(new FormData(event.currentTarget))
                    event.currentTarget.reset()
                  }}
                >
                  <Input name="email" type="email" placeholder="user@miralab.tr" required />
                  <Input name="name" placeholder="Name" required />
                  <select
                    name="role"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="member"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                    Invite user
                  </Button>
                </form>
                <Separator className="my-3" />
                <div className="space-y-1">
                  {usersQuery.data?.users.map((listedUser) => (
                    <div key={listedUser.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{listedUser.name}</span>
                      <Badge variant="outline">{listedUser.role}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>

          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-border border-b p-4">
              <div>
                <h2 className="font-semibold text-lg">
                  {selectedMachine?.name ?? "Machine"} calendar
                </h2>
                <p className="text-muted-foreground text-sm">
                  {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
                </p>
              </div>
              <Button type="button" variant="outline">
                This week
              </Button>
            </div>

            <div className="p-4">
              <WeekCalendar
                bookings={bookings}
                weekDate={new Date(weekRange.start)}
                pendingBookingId={updateBookingMutation.variables?.id ?? null}
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
            </div>
          </section>
        </div>
      </section>

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
    </main>
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

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("admin@miralab.tr")
  const [code, setCode] = useState("")
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestMutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: (result) => {
      setDevCode(result.devCode)
      setCode(result.devCode)
      setError(null)
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(email, code),
    onSuccess: () => {
      setError(null)
      onLoggedIn()
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5">
        <div className="mb-5">
          <p className="text-muted-foreground text-sm">{labConfig.shortName}</p>
          <h1 className="font-semibold text-2xl tracking-tight">{labConfig.appTitle}</h1>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            verifyMutation.mutate()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate(email)}
            >
              Send
            </Button>
          </div>
          {devCode ? (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
              Dev code: <span className="font-mono text-foreground">{devCode}</span>
            </p>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
            Sign in
          </Button>
        </form>
      </section>
    </main>
  )
}

function getWeekRange(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 7)

  return { start: start.toISOString(), end: end.toISOString() }
}
