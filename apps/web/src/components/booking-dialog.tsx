import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AuditEvent, Booking, Machine, User } from "@/lib/api"
import { getBookingDialogDefaults } from "@/lib/booking-dialog-defaults"
import { formatDateTime, fromLabDateTimeParts, toLabDateValue } from "@/lib/time"

export type BookingDialogValue = {
  title: string
  notes: string
  type: "normal" | "maintenance"
  userId?: string
  startsAt: string
  endsAt: string
  reason: string
}

type BookingDialogProps = {
  open: boolean
  mode: "create" | "edit"
  booking: Booking | null
  machine: Machine | null
  currentUser: User
  users: User[]
  isAdmin: boolean
  initialRange?: { startsAt: string; endsAt: string } | null
  initialType?: Booking["type"]
  pending: boolean
  error: string | null
  auditEvents?: AuditEvent[]
  auditLoading?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (value: BookingDialogValue) => void
  onDelete: (reason: string) => void
}

export function BookingDialog({
  open,
  mode,
  booking,
  machine,
  currentUser,
  users,
  isAdmin,
  initialRange,
  initialType,
  pending,
  error,
  auditEvents,
  auditLoading = false,
  onOpenChange,
  onSubmit,
  onDelete,
}: BookingDialogProps) {
  const isMobile = useIsMobile()
  const defaults = getBookingDialogDefaults({ booking, initialRange, initialType })
  const [bookingType, setBookingType] = useState<Booking["type"]>(defaults.type)
  const [ownerUserId, setOwnerUserId] = useState(booking?.userId ?? currentUser.id)
  const isMaintenance = bookingType === "maintenance"
  const sheetTitle =
    mode === "create"
      ? isMaintenance
        ? "New maintenance block"
        : "New booking"
      : isMaintenance
        ? "Edit maintenance block"
        : "Edit booking"
  const [startsDate, setStartsDate] = useState(defaults.startsDate)
  const [startsTime, setStartsTime] = useState(defaults.startsTime)
  const [endsDate, setEndsDate] = useState(defaults.endsDate)
  const [endsTime, setEndsTime] = useState(defaults.endsTime)
  const [adminReason, setAdminReason] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }

    setStartsDate(defaults.startsDate)
    setStartsTime(defaults.startsTime)
    setEndsDate(defaults.endsDate)
    setEndsTime(defaults.endsTime)
    setBookingType(defaults.type)
    setOwnerUserId(booking?.userId ?? currentUser.id)
    setAdminReason("")
  }, [
    open,
    defaults.startsDate,
    defaults.startsTime,
    defaults.endsDate,
    defaults.endsTime,
    defaults.type,
    booking?.userId,
    currentUser.id,
  ])
  const ownerOptions = getOwnerOptions(users, currentUser, booking?.userId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col overflow-hidden p-4 data-[side=bottom]:max-h-[calc(100dvh-1rem)] data-[side=bottom]:rounded-t-xl data-[side=right]:w-full sm:max-w-lg sm:p-5"
      >
        <form
          className="flex min-h-0 flex-1 flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            onSubmit({
              title: String(form.get("title") ?? ""),
              notes: String(form.get("notes") ?? ""),
              type: String(form.get("type") ?? "normal") as "normal" | "maintenance",
              userId: isAdmin && bookingType === "normal" ? ownerUserId : undefined,
              startsAt: fromLabDateTimeParts(startsDate, startsTime),
              endsAt: fromLabDateTimeParts(endsDate, endsTime),
              reason: adminReason,
            })
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription className={machine ? undefined : "sr-only"}>
              {machine ? machine.name : "Create or edit a machine reservation."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-1 pr-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" name="title" defaultValue={defaults.title} required />
              </Field>

              <FieldGroup className="grid gap-4">
                <DateTimeField
                  label="Starts"
                  dateId="startsDate"
                  timeId="startsTime"
                  dateValue={startsDate}
                  timeValue={startsTime}
                  onDateChange={setStartsDate}
                  onTimeChange={setStartsTime}
                />
                <DateTimeField
                  label="Ends"
                  dateId="endsDate"
                  timeId="endsTime"
                  dateValue={endsDate}
                  timeValue={endsTime}
                  onDateChange={setEndsDate}
                  onTimeChange={setEndsTime}
                />
              </FieldGroup>

              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select
                  name="type"
                  value={bookingType}
                  disabled={!isAdmin}
                  onValueChange={(type) => setBookingType(type as Booking["type"])}
                >
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {isAdmin && !isMaintenance ? (
                <Field>
                  <FieldLabel htmlFor="userId">Owner</FieldLabel>
                  <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                    <SelectTrigger id="userId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ownerOptions.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {formatUserOption(user)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" name="notes" defaultValue={defaults.notes} />
              </Field>

              {isAdmin ? (
                <Field>
                  <FieldLabel htmlFor="reason">Admin reason</FieldLabel>
                  <Input
                    id="reason"
                    name="reason"
                    value={adminReason}
                    onChange={(event) => setAdminReason(event.target.value)}
                  />
                </Field>
              ) : null}

              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>

            {isAdmin && mode === "edit" ? (
              <AuditHistory events={auditEvents} loading={auditLoading} users={ownerOptions} />
            ) : null}
          </div>

          <SheetFooter className="-mx-4 mt-0 shrink-0 border-border border-t bg-background px-4 pt-3 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => onDelete(adminReason)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function AuditHistory({
  events,
  loading,
  users,
}: {
  events?: AuditEvent[]
  loading: boolean
  users: User[]
}) {
  return (
    <section
      aria-labelledby="booking-audit-history-title"
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="booking-audit-history-title" className="font-medium text-sm">
          Audit history
        </h3>
        {loading ? (
          <Badge variant="secondary">Loading</Badge>
        ) : (
          <Badge variant="outline">{events?.length ?? 0}</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : events?.length ? (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 rounded-md bg-background px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatAuditAction(event.eventType)}</Badge>
                <span className="font-medium text-sm">
                  {formatAuditActor(event.actorUserId, users)}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">{formatDateTime(event.createdAt)}</div>
              {event.reason ? (
                <div className="text-muted-foreground text-xs">Reason: {event.reason}</div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No audit events yet.</p>
      )}
    </section>
  )
}

function formatAuditAction(eventType: AuditEvent["eventType"]) {
  switch (eventType) {
    case "created":
      return "Created"
    case "updated":
      return "Updated"
    case "deleted":
      return "Deleted"
    case "admin_override":
      return "Admin override"
  }
}

function formatAuditActor(actorUserId: string, users: User[]) {
  const user = users.find((candidate) => candidate.id === actorUserId)

  if (user) {
    return `${user.name} · ${user.email}`
  }

  return `Unknown user · ${actorUserId}`
}

function getOwnerOptions(users: User[], currentUser: User, selectedUserId?: string) {
  const byId = new Map<string, User>()
  for (const user of [currentUser, ...users]) {
    byId.set(user.id, user)
  }

  return [...byId.values()].sort((left, right) => {
    if (left.id === selectedUserId) {
      return -1
    }
    if (right.id === selectedUserId) {
      return 1
    }
    if (left.active !== right.active) {
      return left.active ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

function formatUserOption(user: User) {
  const status = user.active ? "" : " · disabled"
  return `${user.name} · ${user.email}${status}`
}

function DateTimeField({
  label,
  dateId,
  timeId,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
}: {
  label: string
  dateId: string
  timeId: string
  dateValue: string
  timeValue: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedDate = new Date(`${dateValue}T12:00:00`)
  const formattedDate = format(selectedDate, "MMM d, yyyy")

  return (
    <Field>
      <FieldLabel htmlFor={dateId}>{label}</FieldLabel>
      <FieldGroup className="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              id={dateId}
              type="button"
              variant="outline"
              className="justify-start font-normal"
              aria-label={`${label} date ${formattedDate}`}
            >
              <CalendarDays data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{formattedDate}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  onDateChange(toLabDateValue(date))
                  setPickerOpen(false)
                }
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          id={timeId}
          inputMode="numeric"
          autoComplete="off"
          value={timeValue}
          onChange={(event) => onTimeChange(event.target.value)}
          pattern="\d{2}:\d{2}"
          aria-label={`${label} time`}
          required
        />
      </FieldGroup>
    </Field>
  )
}
