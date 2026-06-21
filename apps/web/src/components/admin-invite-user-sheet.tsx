import { MailPlus } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { useIsMobile } from "@/hooks/use-mobile"

export function InviteUserSheet({
  open,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (form: FormData) => void
}) {
  const isMobile = useIsMobile()
  const [pendingAdminInvite, setPendingAdminInvite] = useState<{
    form: FormData
    name: string
    email: string
  } | null>(null)

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPendingAdminInvite(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="overflow-y-auto p-4 data-[side=bottom]:max-h-[calc(100dvh-1rem)] data-[side=bottom]:rounded-t-xl data-[side=right]:w-full sm:max-w-md sm:p-5"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const role = String(form.get("role") ?? "member")
            if (role === "admin") {
              setPendingAdminInvite({
                form,
                name: String(form.get("name") ?? "this user"),
                email: String(form.get("email") ?? "their email"),
              })
              return
            }
            onSubmit(form)
          }}
        >
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>Invite user</SheetTitle>
            <SheetDescription className="sr-only">
              Invite a lab member and assign their access role.
            </SheetDescription>
          </SheetHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="user@miralab.tr"
                autoComplete="email"
                spellCheck={false}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-name">Name</FieldLabel>
              <Input id="invite-name" name="name" placeholder="Researcher name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select name="role" defaultValue="member">
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <SheetFooter className="mt-0 px-0 pb-0">
            <Button type="submit" disabled={pending}>
              <MailPlus data-icon="inline-start" aria-hidden="true" />
              {pending ? "Inviting" : "Send invite"}
            </Button>
          </SheetFooter>
        </form>
        <AlertDialog
          open={pendingAdminInvite !== null}
          onOpenChange={(nextOpen) => !nextOpen && setPendingAdminInvite(null)}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Invite admin?</AlertDialogTitle>
              <AlertDialogDescription>
                This will invite {pendingAdminInvite?.name ?? "this user"} with admin access for{" "}
                {pendingAdminInvite?.email ?? "their email"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending || pendingAdminInvite === null}
                onClick={() => {
                  if (pendingAdminInvite) {
                    onSubmit(pendingAdminInvite.form)
                    setPendingAdminInvite(null)
                  }
                }}
              >
                Send admin invite
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
