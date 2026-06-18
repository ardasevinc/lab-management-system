import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import type { AuditEvent, Booking, Machine } from "@/lib/api"
import { fromLocalDateTimeParts, toLocalDateValue, toLocalTimeValue } from "@/lib/time"

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
  pending,
  error,
  auditEvents,
  onOpenChange,
  onSubmit,
  onDelete,
}: BookingDialogProps) {
  const defaults = dialogDefaults(booking, initialRange)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            onSubmit({
              title: String(form.get("title") ?? ""),
              notes: String(form.get("notes") ?? ""),
              type: String(form.get("type") ?? "normal") as "normal" | "maintenance",
              startsAt: fromLocalDateTimeParts(startsDate, startsTime),
              endsAt: fromLocalDateTimeParts(endsDate, endsTime),
              reason: String(form.get("reason") ?? ""),
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New booking" : "Edit booking"}</DialogTitle>
            <DialogDescription>
              {machine ? `${machine.name} booking details` : "Booking details"}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" name="title" defaultValue={defaults.title} required />
            </Field>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
              <NativeSelect
                id="type"
                name="type"
                className="w-full"
                defaultValue={defaults.type}
                disabled={!isAdmin}
              >
                <NativeSelectOption value="normal">Normal</NativeSelectOption>
                <NativeSelectOption value="maintenance">Maintenance</NativeSelectOption>
              </NativeSelect>
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
                    {event.actorUserId} at {new Date(event.createdAt).toLocaleString()}
                    {event.reason ? <span> ({event.reason})</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
              {formattedDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  onDateChange(toLocalDateValue(date))
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
) {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const later = new Date(now.getTime() + 60 * 60_000)

  return {
    title: booking?.title ?? "",
    notes: booking?.notes ?? "",
    type: booking?.type ?? "normal",
    startsDate: toLocalDateValue(booking?.startsAt ?? range?.startsAt ?? now),
    startsTime: toLocalTimeValue(booking?.startsAt ?? range?.startsAt ?? now),
    endsDate: toLocalDateValue(booking?.endsAt ?? range?.endsAt ?? later),
    endsTime: toLocalTimeValue(booking?.endsAt ?? range?.endsAt ?? later),
  }
}
