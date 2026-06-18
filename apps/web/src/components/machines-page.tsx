import { useWorkspace } from "@/components/app-workspace"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

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

      <div className="grid gap-3 lg:grid-cols-2">
        {machines.map((machine) => (
          <button
            key={machine.id}
            type="button"
            className="rounded-lg border border-border bg-card p-4 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/40 data-[active=true]:bg-accent/50"
            data-active={machine.slug === selectedMachineSlug}
            onClick={() => setSelectedMachineSlug(machine.slug)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{machine.name}</h2>
                <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                  {machine.description}
                </p>
              </div>
              <Badge variant={machine.active ? "secondary" : "outline"}>
                {machine.active ? "bookable" : "inactive"}
              </Badge>
            </div>
            <Separator className="my-3" />
            <p className="text-muted-foreground text-sm">{machine.accessNotes}</p>
            {machine.specs.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {machine.specs.map((spec) => (
                  <Badge key={spec} variant="outline">
                    {spec}
                  </Badge>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </main>
  )
}
