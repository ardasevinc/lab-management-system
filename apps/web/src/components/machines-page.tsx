import { labConfig } from "@lab/config"
import { CalendarDays, Clock3, MonitorCog } from "lucide-react"
import { useWorkspace } from "@/components/app-workspace-context"
import { MachineInventory } from "@/components/machine-inventory"
import { Badge } from "@/components/ui/badge"
import type { Machine } from "@/lib/api"

export function MachinesPage() {
  const { machines, selectedMachine, selectedMachineSlug, setSelectedMachineSlug } = useWorkspace()

  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl tracking-tight">Machines</h1>
      </div>

      {selectedMachine ? <SelectedMachinePanel machine={selectedMachine} /> : null}

      <MachineInventory
        machines={machines}
        selectedMachineSlug={selectedMachineSlug}
        onSelectMachine={setSelectedMachineSlug}
        title="All machines"
        selectionLabel="Use for schedule"
      />
    </main>
  )
}

function SelectedMachinePanel({ machine }: { machine: Machine }) {
  const primarySpec = machine.specs[0] ?? "Specs not set"
  const secondarySpecs = machine.specs.slice(1)

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-medium text-base">{machine.name}</h2>
            <Badge variant={machine.active ? "secondary" : "outline"}>
              {machine.active ? "available" : "inactive"}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">{machine.description}</p>
        </div>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        <MachineFact icon={MonitorCog} label="Primary spec" value={primarySpec} />
        <MachineFact
          icon={CalendarDays}
          label="Other specs"
          value={secondarySpecs.length ? secondarySpecs.join(", ") : "None"}
        />
        <MachineFact icon={Clock3} label="Timezone" value={labConfig.defaultTimezone} />
      </div>
    </section>
  )
}

function MachineFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MonitorCog
  label: string
  value: string
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="mt-1 truncate font-medium text-sm">{value}</div>
        </div>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
