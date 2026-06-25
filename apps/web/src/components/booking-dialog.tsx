import { format } from "date-fns"
import { CalendarDays, Clock3 } from "lucide-react"
import type * as React from "react"
import { useEffect, useState } from "react"
import { BookingAuditHistory } from "@/components/booking-audit-history"
import { BookingDeleteDialog } from "@/components/booking-delete-dialog"
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetDescription,
  ResponsiveSheetFooter,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
} from "@/components/responsive-sheet"
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
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AuditEvent, Booking, Machine, User } from "@/lib/api"
import { getBookingDialogDefaults } from "@/lib/booking-dialog-defaults"
import { fromLabDateTimeParts, toLabDateValue } from "@/lib/time"

const bookingTitleMaxLength = 120
const bookingNotesMaxLength = 2000
const bookingReasonMaxLength = 240

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
    <ResponsiveSheet mobile={isMobile} open={open} onOpenChange={onOpenChange}>
      <ResponsiveSheetContent
        mobile={isMobile}
        side={isMobile ? "bottom" : "right"}
        className="flex overflow-hidden p-0"
        desktopClassName="data-[side=right]:w-full sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          if (isMobile) {
            event.preventDefault()
          }
        }}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
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
          <ResponsiveSheetHeader
            mobile={isMobile}
            className="shrink-0 px-5 pt-6 pr-16 pb-4 sm:px-6 sm:pt-6 sm:pb-4"
          >
            <ResponsiveSheetTitle mobile={isMobile}>{sheetTitle}</ResponsiveSheetTitle>
            <ResponsiveSheetDescription
              mobile={isMobile}
              className={machine ? undefined : "sr-only"}
            >
              {machine ? machine.name : "Create or edit a machine reservation."}
            </ResponsiveSheetDescription>
          </ResponsiveSheetHeader>

          <div className="mobile-drawer-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-5 pb-5 sm:px-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  name="title"
                  defaultValue={defaults.title}
                  maxLength={bookingTitleMaxLength}
                  required
                />
              </Field>

              <FieldGroup className="grid gap-4">
                <DateTimeField
                  label="Starts"
                  dateId="startsDate"
                  timeId="startsTime"
                  dateValue={startsDate}
                  timeValue={startsTime}
                  useNativeInputs={isMobile}
                  onDateChange={setStartsDate}
                  onTimeChange={setStartsTime}
                />
                <DateTimeField
                  label="Ends"
                  dateId="endsDate"
                  timeId="endsTime"
                  dateValue={endsDate}
                  timeValue={endsTime}
                  useNativeInputs={isMobile}
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
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={defaults.notes}
                  maxLength={bookingNotesMaxLength}
                />
              </Field>

              {isAdmin ? (
                <Field>
                  <FieldLabel htmlFor="reason">Audit reason</FieldLabel>
                  <Input
                    id="reason"
                    name="reason"
                    placeholder="Optional note for the booking history"
                    value={adminReason}
                    maxLength={bookingReasonMaxLength}
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

          <ResponsiveSheetFooter
            mobile={isMobile}
            className="shrink-0 border-border border-t bg-background/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-4"
          >
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
          </ResponsiveSheetFooter>
        </form>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  )
}

function getOwnerOptions(users: User[], currentUser: User, selectedUserId?: string) {
  const byId = new Map<string, User>()
  for (const user of [currentUser, ...users]) {
    if (!user.active && user.id !== selectedUserId) {
      continue
    }

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
  useNativeInputs,
  onDateChange,
  onTimeChange,
}: {
  label: string
  dateId: string
  timeId: string
  dateValue: string
  timeValue: string
  useNativeInputs: boolean
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedDate = new Date(`${dateValue}T12:00:00`)
  const formattedDate = format(selectedDate, "MMM d, yyyy")
  const nativeFormattedDate = format(selectedDate, "d MMM yyyy")

  return (
    <Field>
      <FieldLabel htmlFor={dateId}>{label}</FieldLabel>
      <FieldGroup className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.75rem]">
        {useNativeInputs ? (
          <NativePickerField
            id={dateId}
            type="date"
            value={dateValue}
            displayValue={nativeFormattedDate}
            ariaLabel={`${label} date`}
            icon={<CalendarDays aria-hidden="true" />}
            onChange={(event) => onDateChange(event.target.value)}
          />
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
        {useNativeInputs ? (
          <NativePickerField
            id={timeId}
            type="time"
            value={timeValue}
            displayValue={timeValue}
            ariaLabel={`${label} time`}
            icon={<Clock3 aria-hidden="true" />}
            onChange={(event) => onTimeChange(event.target.value)}
          />
        ) : (
          <Input
            id={timeId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={timeValue}
            onChange={(event) => onTimeChange(event.target.value)}
            pattern="\d{2}:\d{2}"
            aria-label={`${label} time`}
            required
          />
        )}
      </FieldGroup>
    </Field>
  )
}

function NativePickerField({
  id,
  type,
  value,
  displayValue,
  ariaLabel,
  icon,
  onChange,
}: {
  id: string
  type: "date" | "time"
  value: string
  displayValue: string
  ariaLabel: string
  icon: React.ReactNode
  onChange: React.ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <div
      data-native-picker-field
      className="relative flex h-12 min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 text-base shadow-xs transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50"
    >
      <span className="min-w-0 truncate font-normal tabular-nums">{displayValue}</span>
      <span className="shrink-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-4">
        {icon}
      </span>
      <input
        id={id}
        data-native-picker-input
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        type={type}
        autoComplete="off"
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        required
      />
    </div>
  )
}
