import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Booking, Machine } from "@/lib/api"
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
  onOpenChange,
  onSubmit,
  onDelete,
}: BookingDialogProps) {
  const defaults = dialogDefaults(booking, initialRange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="space-y-4"
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

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={defaults.title} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={defaults.startsAt}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={defaults.endsAt}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={defaults.type}
              disabled={!isAdmin}
            >
              <option value="normal">Normal</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={defaults.notes} />
          </div>

          {isAdmin ? (
            <div className="grid gap-2">
              <Label htmlFor="reason">Admin reason</Label>
              <Input id="reason" name="reason" defaultValue="" />
            </div>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

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
