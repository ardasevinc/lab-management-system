import { Check, MonitorCog, Pencil } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  onEditMachine?: (machine: Machine) => void
  showAccessNotes?: boolean
  title?: string
  selectionLabel?: string
  emptyAction?: ReactNode
}

export function MachineInventory({
  machines,
  selectedMachineSlug,
  onSelectMachine,
  onEditMachine,
  showAccessNotes = false,
  title = "Machine inventory",
  selectionLabel = "Use",
  emptyAction,
}: MachineInventoryProps) {
  const [machineFilter, setMachineFilter] = useState("")
  const filteredMachines = filterMachines(machines, machineFilter)
  const hasMachineFilter = machineFilter.trim().length > 0

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-sm">{title}</h2>
          </div>
          <Badge variant="outline">{formatMachineCount(machines.length)}</Badge>
        </div>
        {machines.length > 1 ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Field className="max-w-sm gap-1.5">
              <FieldLabel htmlFor="machine-filter" className="sr-only">
                Filter machines
              </FieldLabel>
              <Input
                id="machine-filter"
                value={machineFilter}
                onChange={(event) => setMachineFilter(event.target.value)}
                placeholder="Filter by name, specs, status"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="text-muted-foreground text-xs">
                {filteredMachines.length}/{machines.length} shown
              </span>
              {hasMachineFilter && filteredMachines.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMachineFilter("")}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {machines.length ? (
        filteredMachines.length ? (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead className="w-28">State</TableHead>
                    <TableHead>Specs</TableHead>
                    {showAccessNotes ? <TableHead>Access</TableHead> : null}
                    {onSelectMachine || onEditMachine ? (
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMachines.map((machine) => {
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
                        {showAccessNotes ? (
                          <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                            {machine.accessNotes || "Not set"}
                          </TableCell>
                        ) : null}
                        {onSelectMachine || onEditMachine ? (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {onSelectMachine ? (
                                isSelected ? (
                                  <Badge variant="secondary">
                                    <Check aria-hidden="true" />
                                    Selected
                                  </Badge>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSelectMachine(machine.slug)}
                                  >
                                    {selectionLabel}
                                  </Button>
                                )
                              ) : null}
                              {onEditMachine ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onEditMachine(machine)}
                                >
                                  <Pencil data-icon="inline-start" aria-hidden="true" />
                                  Edit
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border lg:hidden">
              {filteredMachines.map((machine) => {
                const isSelected = machine.slug === selectedMachineSlug

                return (
                  <article
                    key={machine.id}
                    className={cn("px-4 py-3", isSelected && "bg-accent/45")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-sm">{machine.name}</h3>
                        <p className="mt-1 text-muted-foreground text-sm">{machine.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <MachineStateBadge active={machine.active} />
                        {isSelected ? (
                          <Badge variant="secondary">
                            <Check aria-hidden="true" />
                            Selected
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-3 grid gap-2 text-sm">
                      {showAccessNotes ? (
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground text-xs">Access</dt>
                          <dd>{machine.accessNotes || "Not set"}</dd>
                        </div>
                      ) : null}
                      {machine.specs.length ? (
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground text-xs">Specs</dt>
                          <dd>
                            <SpecList specs={machine.specs} />
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {onSelectMachine && !isSelected ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => onSelectMachine(machine.slug)}
                      >
                        {selectionLabel}
                      </Button>
                    ) : null}
                    {onEditMachine ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => onEditMachine(machine)}
                      >
                        <Pencil data-icon="inline-start" aria-hidden="true" />
                        Edit machine
                      </Button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </>
        ) : (
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MonitorCog aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No matching machines</EmptyTitle>
              <EmptyDescription>Try a machine name, spec, or status.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={() => setMachineFilter("")}>
                Clear filter
              </Button>
            </EmptyContent>
          </Empty>
        )
      ) : (
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorCog aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No machines configured</EmptyTitle>
            <EmptyDescription>Add a machine before researchers can book lab time.</EmptyDescription>
          </EmptyHeader>
          {emptyAction ? <EmptyContent>{emptyAction}</EmptyContent> : null}
        </Empty>
      )}
    </section>
  )
}

function filterMachines(machines: Machine[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase()
  if (!normalizedFilter) {
    return machines
  }

  return machines.filter((machine) => {
    const searchable = [
      machine.name,
      machine.slug,
      machine.description,
      machine.specs.join(" "),
      machine.accessNotes,
      machine.active ? "available active bookable" : "inactive disabled",
    ].join(" ")

    return searchable.toLowerCase().includes(normalizedFilter)
  })
}

function MachineStateBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>{active ? "available" : "inactive"}</Badge>
  )
}

function SpecList({ specs }: { specs: string[] }) {
  if (!specs.length) {
    return <span className="text-muted-foreground">Not set</span>
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

function formatMachineCount(count: number) {
  return count === 1 ? "1 machine" : `${count} machines`
}
