import { Check, MonitorCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Machine } from "@/lib/api"
import { cn } from "@/lib/utils"

type MachineInventoryProps = {
  machines: Machine[]
  selectedMachineSlug?: string
  onSelectMachine?: (slug: string) => void
  selectionLabel?: string
}

export function MachineInventory({
  machines,
  selectedMachineSlug,
  onSelectMachine,
  selectionLabel = "Use",
}: MachineInventoryProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
        <div>
          <h2 className="font-medium text-sm">Machine inventory</h2>
          <p className="text-muted-foreground text-xs">{machines.length} configured</p>
        </div>
        <MonitorCog className="text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead className="w-28">State</TableHead>
              <TableHead>Specs</TableHead>
              <TableHead>Access</TableHead>
              {onSelectMachine ? <TableHead className="w-28 text-right">Default</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((machine) => {
              const isSelected = machine.slug === selectedMachineSlug

              return (
                <TableRow key={machine.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell className="min-w-56 whitespace-normal">
                    <div className="font-medium">{machine.name}</div>
                    <div className="mt-1 max-w-xl text-muted-foreground text-sm">
                      {machine.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <MachineStateBadge active={machine.active} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <SpecList specs={machine.specs} />
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                    {machine.accessNotes}
                  </TableCell>
                  {onSelectMachine ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant={isSelected ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => onSelectMachine(machine.slug)}
                      >
                        {isSelected ? <Check data-icon="inline-start" aria-hidden="true" /> : null}
                        {isSelected ? "Selected" : selectionLabel}
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {machines.map((machine) => {
          const isSelected = machine.slug === selectedMachineSlug

          return (
            <article key={machine.id} className={cn("px-4 py-3", isSelected && "bg-accent/45")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-sm">{machine.name}</h3>
                  <p className="mt-1 text-muted-foreground text-sm">{machine.description}</p>
                </div>
                <MachineStateBadge active={machine.active} />
              </div>

              <dl className="mt-3 grid gap-2 text-sm">
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Access</dt>
                  <dd>{machine.accessNotes}</dd>
                </div>
                {machine.specs.length ? (
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Specs</dt>
                    <dd>
                      <SpecList specs={machine.specs} />
                    </dd>
                  </div>
                ) : null}
              </dl>

              {onSelectMachine ? (
                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "outline"}
                  className="mt-3 w-full"
                  onClick={() => onSelectMachine(machine.slug)}
                >
                  {isSelected ? <Check data-icon="inline-start" aria-hidden="true" /> : null}
                  {isSelected ? "Selected machine" : selectionLabel}
                </Button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function MachineStateBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>{active ? "bookable" : "inactive"}</Badge>
  )
}

function SpecList({ specs }: { specs: string[] }) {
  if (!specs.length) {
    return <span className="text-muted-foreground">No specs recorded</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {specs.map((spec) => (
        <Badge key={spec} variant="outline">
          {spec}
        </Badge>
      ))}
    </div>
  )
}
