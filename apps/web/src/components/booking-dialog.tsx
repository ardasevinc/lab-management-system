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
import type { AuditEvent, Booking, Machine } from "@/lib/api"
import { formatDateTime, fromLabDateTimeParts, toLabDateValue, toLabTimeValue } from "@/lib/time"

export type BookingDialogValue = {
  title: string
  notes: string
  type: "normal" | "maintenance"
  startsAt: string
  endsAt: string
  reason: string
}

type BookingDialogProps = {
  open: boolean
  mode: "create" | "edit"
  booking: Booking | null
  machine: Machine | null
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
  const defaults = dialogDefaults(booking, initialRange, initialType)
  const isMaintenance = defaults.type === "maintenance"
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
  }, [open, defaults.startsDate, defaults.startsTime, defaults.endsDate, defaults.endsTime])

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
              startsAt: fromLabDateTimeParts(startsDate, startsTime),
              endsAt: fromLabDateTimeParts(endsDate, endsTime),
              reason: String(form.get("reason") ?? ""),
            })
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>
              {machine
                ? `${machine.name} ${isMaintenance ? "maintenance" : "booking"} details`
                : isMaintenance
                  ? "Maintenance details"
                  : "Booking details"}
            </SheetDescription>
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
              <Select name="type" defaultValue={defaults.type} disabled={!isAdmin}>
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

function dialogDefaults(
  booking: Booking | null,
  range?: { startsAt: string; endsAt: string } | null,
  initialType: Booking["type"] = "normal",
) {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const later = new Date(now.getTime() + 60 * 60_000)

  return {
    title: booking?.title ?? "",
    notes: booking?.notes ?? "",
    type: booking?.type ?? initialType,
    startsDate: toLabDateValue(booking?.startsAt ?? range?.startsAt ?? now),
    startsTime: toLabTimeValue(booking?.startsAt ?? range?.startsAt ?? now),
    endsDate: toLabDateValue(booking?.endsAt ?? range?.endsAt ?? later),
    endsTime: toLabTimeValue(booking?.endsAt ?? range?.endsAt ?? later),
  }
}
