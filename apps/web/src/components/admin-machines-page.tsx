import { Navigate } from "@tanstack/react-router"
import { Plus, Save, Trash2 } from "lucide-react"
import { useState } from "react"
import { AdminPageFrame } from "@/components/admin-page-frame"
import {
  type MachineCreateValue,
  type MachineUpdateValue,
  useWorkspace,
} from "@/components/app-workspace-context"
import { MachineInventory } from "@/components/machine-inventory"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import type { Machine } from "@/lib/api"

export function AdminMachinesPage() {
  const workspace = useWorkspace()
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [creatingMachine, setCreatingMachine] = useState(false)

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AdminPageFrame
      title="Machines"
      description="Machine inventory"
      action={
        <Button type="button" onClick={() => setCreatingMachine(true)}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New machine
        </Button>
      }
    >
      <MachineInventory
        machines={workspace.machines}
        showAccessNotes
        onEditMachine={setEditingMachine}
        onToggleMachineActive={(machine) =>
          workspace.updateMachine(machine, {
            name: machine.name,
            description: machine.description,
            specs: machine.specs,
            accessNotes: machine.accessNotes,
            active: !machine.active,
          })
        }
        activePendingMachineId={workspace.machineUpdatePendingId}
        emptyAction={
          <Button type="button" onClick={() => setCreatingMachine(true)}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            New machine
          </Button>
        }
      />
      <MachineEditorSheet
        mode="edit"
        machine={editingMachine}
        open={Boolean(editingMachine)}
        pending={
          workspace.machineUpdatePendingId === editingMachine?.id ||
          workspace.machineDeletePendingId === editingMachine?.id
        }
        error={workspace.adminSheetError}
        onOpenChange={(open) => {
          if (!open) {
            workspace.clearAdminSheetError()
            setEditingMachine(null)
          }
        }}
        onSubmit={(value) => {
          if (!editingMachine) {
            return
          }

          workspace.updateMachine(editingMachine, value, {
            onSuccess: () => setEditingMachine(null),
          })
        }}
        onDelete={() => {
          if (!editingMachine) {
            return
          }

          workspace.deleteMachine(editingMachine, {
            onSuccess: () => setEditingMachine(null),
          })
        }}
      />
      <MachineEditorSheet
        mode="create"
        machine={null}
        open={creatingMachine}
        pending={workspace.machineCreatePending}
        error={workspace.adminSheetError}
        onOpenChange={(open) => {
          if (!open) {
            workspace.clearAdminSheetError()
            setCreatingMachine(false)
          }
        }}
        onSubmit={(value) => {
          workspace.createMachine(value, {
            onSuccess: () => setCreatingMachine(false),
          })
        }}
      />
    </AdminPageFrame>
  )
}

function MachineEditorSheet({
  mode,
  machine,
  open,
  pending,
  error,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit"
  machine: Machine | null
  open: boolean
  pending: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (value: MachineCreateValue | MachineUpdateValue) => void
  onDelete?: () => void
}) {
  const isMobile = useIsMobile()

  if (mode === "edit" && !machine) {
    return null
  }

  const defaults = machine ?? {
    id: "new",
    slug: "",
    name: "",
    description: "",
    specs: [],
    accessNotes: "",
    active: true,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="overflow-y-auto overflow-x-hidden p-4 data-[side=bottom]:max-h-[calc(100svh-1rem)] data-[side=right]:w-full sm:max-w-lg sm:p-5"
        onOpenAutoFocus={(event) => {
          if (isMobile) {
            event.preventDefault()
          }
        }}
      >
        <form
          key={`${mode}-${defaults.id}`}
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const value = {
              name: String(form.get("name") ?? "").trim(),
              slug:
                mode === "create" ? String(form.get("slug") ?? "").trim() || undefined : undefined,
              description: String(form.get("description") ?? "").trim(),
              specs: parseMachineSpecs(String(form.get("specs") ?? "")),
              accessNotes: String(form.get("accessNotes") ?? "").trim(),
              active: form.get("active") === "true",
            }

            if (mode === "edit") {
              const { slug: _slug, ...updateValue } = value
              onSubmit(updateValue)
              return
            }

            onSubmit(value)
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{mode === "create" ? "New machine" : "Edit machine"}</SheetTitle>
            <SheetDescription>
              {mode === "create" ? "Machine details" : defaults.slug}
            </SheetDescription>
          </SheetHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="machine-name">Name</FieldLabel>
              <Input id="machine-name" name="name" defaultValue={defaults.name} required />
            </Field>
            {mode === "create" ? (
              <Field>
                <FieldLabel htmlFor="machine-slug">Slug</FieldLabel>
                <Input
                  id="machine-slug"
                  name="slug"
                  defaultValue={defaults.slug}
                  placeholder="gpu-2"
                  spellCheck={false}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="machine-state">Booking state</FieldLabel>
              <Select name="active" defaultValue={String(defaults.active)}>
                <SelectTrigger id="machine-state" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="true">Available</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-description">Description</FieldLabel>
              <Textarea
                id="machine-description"
                name="description"
                defaultValue={defaults.description}
                rows={4}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-specs">Specs</FieldLabel>
              <Textarea
                id="machine-specs"
                name="specs"
                defaultValue={defaults.specs.join("\n")}
                rows={5}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="machine-access-notes">Access notes</FieldLabel>
              <Textarea
                id="machine-access-notes"
                name="accessNotes"
                defaultValue={defaults.accessNotes}
                rows={4}
              />
            </Field>
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <SheetFooter className="mt-0 gap-2 px-0 pb-0 sm:flex-row sm:items-center sm:justify-between">
            {mode === "edit" && onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={pending}>
                    <Trash2 data-icon="inline-start" aria-hidden="true" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete machine?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the machine only if it has no booking history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={pending} onClick={onDelete}>
                      Delete machine
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              <Save data-icon="inline-start" aria-hidden="true" />
              {pending ? "Saving" : mode === "create" ? "Create machine" : "Save machine"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function parseMachineSpecs(value: string) {
  return value
    .split(/\n|,/)
    .map((spec) => spec.trim())
    .filter(Boolean)
}
