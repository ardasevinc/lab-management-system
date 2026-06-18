import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import type { AuditEvent, Booking, Machine } from "@/lib/api"
import { fromLocalInputValue, toLocalInputValue } from "@/lib/time"

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
              startsAt: fromLocalInputValue(String(form.get("startsAt") ?? "")),
              endsAt: fromLocalInputValue(String(form.get("endsAt") ?? "")),
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startsAt">Starts</FieldLabel>
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={defaults.startsAt}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endsAt">Ends</FieldLabel>
                <Input
                  id="endsAt"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={defaults.endsAt}
                  required
                />
              </Field>
            </div>

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
    startsAt: toLocalInputValue(booking?.startsAt ?? range?.startsAt ?? now),
    endsAt: toLocalInputValue(booking?.endsAt ?? range?.endsAt ?? later),
  }
}
