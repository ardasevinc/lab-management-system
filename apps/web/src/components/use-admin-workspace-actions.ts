import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import type { MachineCreateValue, MachineUpdateValue } from "@/components/app-workspace-context"
import { apiFetch, type Machine, type User } from "@/lib/api"

export function useAdminWorkspaceActions({
  queryClient,
  setAdminSheetError,
  setWorkspaceError,
  onMachineDeleted,
}: {
  queryClient: QueryClient
  setAdminSheetError: (error: string | null) => void
  setWorkspaceError: (error: string | null) => void
  onMachineDeleted: (machine: Machine) => void
}) {
  const inviteMutation = useMutation({
    mutationFn: (form: FormData) =>
      apiFetch<{ invite: User }>("/admin/invites", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          name: String(form.get("name") ?? ""),
          role: String(form.get("role") ?? "member"),
        }),
      }),
    onSuccess: () => {
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const userAccessMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: { active?: boolean; role?: User["role"] } }) =>
      apiFetch<{ user: User }>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      }),
    onSuccess: () => {
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error: Error) => {
      setWorkspaceError(error.message)
    },
  })

  const machineUpdateMutation = useMutation({
    mutationFn: ({
      id,
      value,
      onSuccess,
    }: {
      id: string
      value: MachineUpdateValue
      onSuccess?: () => void
    }) =>
      apiFetch<{ machine: Machine }>(`/admin/machines/${id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      }).then(() => ({ onSuccess })),
    onSuccess: ({ onSuccess }) => {
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const machineCreateMutation = useMutation({
    mutationFn: ({ value, onSuccess }: { value: MachineCreateValue; onSuccess?: () => void }) =>
      apiFetch<{ machine: Machine }>("/admin/machines", {
        method: "POST",
        body: JSON.stringify(value),
      }).then(() => ({ onSuccess })),
    onSuccess: ({ onSuccess }) => {
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  const machineDeleteMutation = useMutation({
    mutationFn: ({ machine, onSuccess }: { machine: Machine; onSuccess?: () => void }) =>
      apiFetch<{ machine: Machine }>(`/admin/machines/${machine.id}`, {
        method: "DELETE",
      }).then(() => ({ machine, onSuccess })),
    onSuccess: ({ machine, onSuccess }) => {
      onMachineDeleted(machine)
      setAdminSheetError(null)
      setWorkspaceError(null)
      queryClient.invalidateQueries({ queryKey: ["machines"] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      setAdminSheetError(error.message)
    },
  })

  return {
    invitePending: inviteMutation.isPending,
    userAccessPendingId: userAccessMutation.isPending ? userAccessMutation.variables.id : null,
    machineCreatePending: machineCreateMutation.isPending,
    machineUpdatePendingId: machineUpdateMutation.isPending
      ? machineUpdateMutation.variables.id
      : null,
    machineDeletePendingId: machineDeleteMutation.isPending
      ? machineDeleteMutation.variables.machine.id
      : null,
    inviteUser: (form: FormData, options?: { onSuccess?: () => void }) => {
      setAdminSheetError(null)
      inviteMutation.mutate(form, { onSuccess: options?.onSuccess })
    },
    updateUserAccess: (targetUser: User, access: { active?: boolean; role?: User["role"] }) =>
      userAccessMutation.mutate({ id: targetUser.id, value: access }),
    updateMachine: (
      machine: Machine,
      machineUpdate: MachineUpdateValue,
      options?: { onSuccess?: () => void },
    ) => {
      setAdminSheetError(null)
      machineUpdateMutation.mutate({
        id: machine.id,
        value: machineUpdate,
        onSuccess: options?.onSuccess,
      })
    },
    createMachine: (machineCreate: MachineCreateValue, options?: { onSuccess?: () => void }) => {
      setAdminSheetError(null)
      machineCreateMutation.mutate({
        value: machineCreate,
        onSuccess: options?.onSuccess,
      })
    },
    deleteMachine: (machine: Machine, options?: { onSuccess?: () => void }) => {
      setAdminSheetError(null)
      machineDeleteMutation.mutate({
        machine,
        onSuccess: options?.onSuccess,
      })
    },
  }
}
