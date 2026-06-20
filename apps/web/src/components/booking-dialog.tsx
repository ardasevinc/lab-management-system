import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
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
  onOpenChange: (open: boolean) => void
  onSubmit: (value: BookingDialogValue) => void
  onDelete: () => void
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
  onOpenChange,
  onSubmit,
  onDelete,
}: BookingDialogProps) {
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
      <SheetContent className="overflow-y-auto p-4 data-[side=right]:w-full sm:max-w-lg sm:p-5">
        <form
          className="flex min-h-full flex-col gap-5"
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
              reason: String(form.get("reason") ?? ""),
            })
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{sheetTitle}</SheetTitle>
            {machine ? <SheetDescription>{machine.name}</SheetDescription> : null}
          </SheetHeader>

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
                <Input id="reason" name="reason" defaultValue="" />
              </Field>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          {auditEvents?.length ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-2 font-medium text-sm">Audit history</div>
              <div className="grid gap-2">
                {auditEvents.map((event) => (
                  <div key={event.id} className="text-muted-foreground text-xs">
                    <span className="font-medium text-foreground">{event.eventType}</span> by{" "}
                    {event.actorUserId} at {formatDateTime(event.createdAt)}
                    {event.reason ? <span> ({event.reason})</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <SheetFooter className="px-0 pb-0 sm:flex-row sm:items-center sm:justify-between">
            {mode === "edit" ? (
              <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
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
