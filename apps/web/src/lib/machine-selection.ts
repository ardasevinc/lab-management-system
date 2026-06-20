import type { Machine } from "@/lib/api"

export function resolveSelectedMachine(machines: Machine[], requestedSlug: string) {
  return machines.find((machine) => machine.slug === requestedSlug) ?? machines[0] ?? null
}

export function resolveSelectedMachineSlug(machines: Machine[], requestedSlug: string) {
  return resolveSelectedMachine(machines, requestedSlug)?.slug ?? requestedSlug
}
