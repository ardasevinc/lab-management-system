import { useWorkspace } from "@/components/app-workspace"
import { MachineInventory } from "@/components/machine-inventory"

export function MachinesPage() {
  const { machines, selectedMachineSlug, setSelectedMachineSlug } = useWorkspace()

  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl tracking-tight">Machines</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Bookable lab machines and access notes.
        </p>
      </div>

      <MachineInventory
        machines={machines}
        selectedMachineSlug={selectedMachineSlug}
        onSelectMachine={setSelectedMachineSlug}
      />
    </main>
  )
}
