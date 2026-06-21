import type { Machine } from "@/lib/api"

export function resolveSelectedMachine(machines: Machine[], requestedSlug: string) {
  const activeMachines = machines.filter((machine) => machine.active)

  return (
    activeMachines.find((machine) => machine.slug === requestedSlug) ??
    activeMachines[0] ??
    machines.find((machine) => machine.slug === requestedSlug) ??
    machines[0] ??
    null
  )
}

export function resolveSelectedMachineSlug(machines: Machine[], requestedSlug: string) {
  return resolveSelectedMachine(machines, requestedSlug)?.slug ?? requestedSlug
}
