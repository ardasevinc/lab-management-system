import { MailPlus } from "lucide-react"
import { useState } from "react"
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetDescription,
  ResponsiveSheetFooter,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
} from "@/components/responsive-sheet"
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
    <ResponsiveSheet
      mobile={isMobile}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPendingAdminInvite(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <ResponsiveSheetContent
        mobile={isMobile}
        side={isMobile ? "bottom" : "right"}
        className="flex overflow-hidden p-0"
        desktopClassName="data-[side=right]:w-full sm:max-w-md"
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
          <ResponsiveSheetHeader
            mobile={isMobile}
            className="shrink-0 px-5 pt-6 pr-16 pb-4 sm:px-5 sm:pt-5 sm:pb-4"
          >
            <ResponsiveSheetTitle mobile={isMobile}>Invite user</ResponsiveSheetTitle>
            <ResponsiveSheetDescription mobile={isMobile} className="sr-only">
              Invite a lab member and assign their access role.
            </ResponsiveSheetDescription>
          </ResponsiveSheetHeader>

          <div className="mobile-drawer-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-5">
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
              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>
          </div>

          <ResponsiveSheetFooter
            mobile={isMobile}
            className="shrink-0 border-border border-t bg-background/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur"
          >
            <Button type="submit" disabled={pending}>
              <MailPlus data-icon="inline-start" aria-hidden="true" />
              {pending ? "Inviting" : "Send invite"}
            </Button>
          </ResponsiveSheetFooter>
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
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  )
}
