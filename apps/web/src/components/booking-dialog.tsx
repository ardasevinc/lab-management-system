import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"
import { BookingAuditHistory } from "@/components/booking-audit-history"
import { BookingDeleteDialog } from "@/components/booking-delete-dialog"
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
import { useIsMobile } from "@/hooks/use-mobile"
import type { AuditEvent, Booking, Machine, User } from "@/lib/api"
import { getBookingDialogDefaults } from "@/lib/booking-dialog-defaults"
import { fromLabDateTimeParts, toLabDateValue } from "@/lib/time"

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
  canMutate: boolean
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
  canMutate,
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
        className="flex flex-col overflow-hidden p-4 data-[side=bottom]:max-h-[calc(100svh-1rem)] data-[side=right]:w-full sm:max-w-lg sm:p-6"
        onOpenAutoFocus={(event) => {
          if (isMobile) {
            event.preventDefault()
          }
        }}
      >
        <form
          className="flex min-h-0 flex-1 flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canMutate) {
              return
            }
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

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-1 pb-2">
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
                  inlineDatePicker={isMobile}
                  onDateChange={setStartsDate}
                  onTimeChange={setStartsTime}
                />
                <DateTimeField
                  label="Ends"
                  dateId="endsDate"
                  timeId="endsTime"
                  dateValue={endsDate}
                  timeValue={endsTime}
                  inlineDatePicker={isMobile}
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
                  <FieldLabel htmlFor="reason">Audit reason</FieldLabel>
                  <Input
                    id="reason"
                    name="reason"
                    placeholder="Optional note for the booking history"
                    value={adminReason}
                    onChange={(event) => setAdminReason(event.target.value)}
                  />
                </Field>
              ) : null}

              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>

            {isAdmin && mode === "edit" ? (
              <BookingAuditHistory
                events={auditEvents}
                loading={auditLoading}
                users={ownerOptions}
              />
            ) : null}
          </div>

          <SheetFooter className="-mx-4 mt-0 shrink-0 border-border border-t bg-background px-4 pt-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {mode === "edit" && canMutate ? (
              <BookingDeleteDialog pending={pending} reason={adminReason} onDelete={onDelete} />
            ) : (
              <span />
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {canMutate ? (
                <Button type="submit" disabled={pending}>
                  {mode === "create" ? "Create" : "Save"}
                </Button>
              ) : null}
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
  inlineDatePicker,
  onDateChange,
  onTimeChange,
}: {
  label: string
  dateId: string
  timeId: string
  dateValue: string
  timeValue: string
  inlineDatePicker: boolean
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedDate = new Date(`${dateValue}T12:00:00`)
  const formattedDate = format(selectedDate, "MMM d, yyyy")

  return (
    <Field>
      <FieldLabel htmlFor={dateId}>{label}</FieldLabel>
      <FieldGroup className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.75rem]">
        {inlineDatePicker ? (
          <div className="grid min-w-0 gap-2">
            <Button
              id={dateId}
              type="button"
              variant="outline"
              className="min-w-0 justify-start font-normal"
              aria-label={`${label} date ${formattedDate}`}
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((open) => !open)}
            >
              <CalendarDays data-icon="inline-start" aria-hidden="true" />
              <span className="truncate">{formattedDate}</span>
            </Button>
            {pickerOpen ? (
              <div className="max-w-full overflow-hidden rounded-lg border border-border bg-background p-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  className="mx-auto max-w-full"
                  onSelect={(date) => {
                    if (date) {
                      onDateChange(toLabDateValue(date))
                    }
                    setPickerOpen(false)
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id={dateId}
                type="button"
                variant="outline"
                className="min-w-0 justify-start font-normal"
                aria-label={`${label} date ${formattedDate}`}
              >
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                <span className="truncate">{formattedDate}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto max-w-[calc(100vw-2rem)] p-0"
              align="start"
              sideOffset={8}
              collisionPadding={16}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(toLabDateValue(date))
                  }
                  setPickerOpen(false)
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        )}
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
