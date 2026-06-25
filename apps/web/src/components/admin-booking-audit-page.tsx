import { useQuery } from "@tanstack/react-query"
import { Navigate } from "@tanstack/react-router"
import { CalendarClock, ExternalLink, History, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"
import { AdminPageFrame } from "@/components/admin-page-frame"
import { useWorkspace } from "@/components/app-workspace-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type AdminBookingAuditEvent, apiFetch } from "@/lib/api"
import { formatDate, formatDateTime, formatTime } from "@/lib/time"
import { cn } from "@/lib/utils"

type AuditEventFilter = AdminBookingAuditEvent["eventType"] | "all"

export function AdminBookingAuditPage() {
  const workspace = useWorkspace()
  const [eventFilter, setEventFilter] = useState<AuditEventFilter>("all")
  const [search, setSearch] = useState("")
  const auditQuery = useQuery({
    queryKey: ["admin-booking-audit"],
    queryFn: () => apiFetch<{ events: AdminBookingAuditEvent[] }>("/admin/booking-audit?limit=150"),
    enabled: workspace.user.role === "admin",
    refetchInterval: 15_000,
  })

  const events = auditQuery.data?.events ?? []
  const filteredEvents = useMemo(
    () => filterAuditEvents(events, { eventFilter, search }),
    [eventFilter, events, search],
  )
  const metrics = getAuditMetrics(events)

  if (workspace.user.role !== "admin") {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AdminPageFrame
      title="Booking audit"
      description="Recent booking changes"
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isFetching}
        >
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        <AuditMetric icon={History} label="Events" value={events.length} detail="latest changes" />
        <AuditMetric
          icon={CalendarClock}
          label="Updates"
          value={metrics.updated}
          detail="changed bookings"
        />
        <AuditMetric icon={ShieldCheck} label="Deleted" value={metrics.deleted} detail="removed" />
        <AuditMetric
          icon={Search}
          label="Latest actor"
          value={metrics.latestActor}
          detail={metrics.latestAt}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 border-border border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-medium text-base">Audit trail</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:w-[560px]">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search audit"
                placeholder="Search title, owner, actor, machine, reason"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </InputGroup>
            <Select
              value={eventFilter}
              onValueChange={(value) => setEventFilter(value as AuditEventFilter)}
            >
              <SelectTrigger aria-label="Event type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="admin_override">Overrides</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {auditQuery.isPending ? (
          <AuditSkeleton />
        ) : filteredEvents.length ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Event</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead className="w-56">Actor</TableHead>
                    <TableHead className="w-48">When</TableHead>
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <AuditTableRow
                      key={event.id}
                      event={event}
                      onOpen={() => openAuditBooking(workspace, event)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {filteredEvents.map((event) => (
                <AuditListItem
                  key={event.id}
                  event={event}
                  onOpen={() => openAuditBooking(workspace, event)}
                />
              ))}
            </div>
          </>
        ) : (
          <Empty className="min-h-72 rounded-none border-0">
            <EmptyMedia variant="icon">
              <History aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No matching audit events</EmptyTitle>
              <EmptyDescription>
                Change the search or event filter to inspect recent booking history.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </AdminPageFrame>
  )
}

function AuditTableRow({ event, onOpen }: { event: AdminBookingAuditEvent; onOpen: () => void }) {
  const canOpen = !event.booking.deletedAt

  return (
    <TableRow>
      <TableCell>
        <AuditEventLabel eventType={event.eventType} />
      </TableCell>
      <TableCell className="min-w-0">
        <BookingSummary event={event} />
      </TableCell>
      <TableCell className="min-w-[220px]">
        <ChangeSummary event={event} />
      </TableCell>
      <TableCell>
        <div className="min-w-0">
          <div className="truncate font-medium text-sm">{event.actor.name}</div>
          <div className="truncate text-muted-foreground text-xs">{event.actor.email}</div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {formatDateTime(event.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        {canOpen ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            <ExternalLink data-icon="inline-start" aria-hidden="true" />
            Open
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">Deleted</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function AuditListItem({ event, onOpen }: { event: AdminBookingAuditEvent; onOpen: () => void }) {
  const canOpen = !event.booking.deletedAt

  return (
    <article className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AuditListHeadline event={event} />
          <BookingSummary event={event} />
        </div>
        {canOpen ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            <ExternalLink data-icon="inline-start" aria-hidden="true" />
            Open
          </Button>
        ) : (
          <span className="shrink-0 pt-1 text-muted-foreground text-xs">Deleted record</span>
        )}
      </div>
      <ChangeSummary event={event} surface="list" />
      <div className="flex flex-col gap-1 text-muted-foreground text-xs">
        <span className="truncate">
          {event.actor.name} · {event.actor.email}
        </span>
        <span className="tabular-nums">{formatDateTime(event.createdAt)}</span>
      </div>
    </article>
  )
}

function BookingSummary({ event }: { event: AdminBookingAuditEvent }) {
  const snapshot = getEventBookingSnapshot(event)

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        <span className="truncate font-medium text-sm">{snapshot.title}</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
        <span>{snapshot.type === "maintenance" ? "Maintenance" : "Booking"}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{event.owner.name}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{event.machine.name}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {formatDate(snapshot.startsAt)} {formatTime(snapshot.startsAt)} -{" "}
          {formatTime(snapshot.endsAt)}
        </span>
      </div>
    </div>
  )
}

function ChangeSummary({
  event,
  surface = "table",
}: {
  event: AdminBookingAuditEvent
  surface?: "table" | "list"
}) {
  const summary = describeAuditEvent(event)
  const showSummary =
    surface === "table" || event.eventType === "updated" || event.eventType === "admin_override"

  if (!showSummary && !event.reason) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {showSummary ? <span className="text-sm">{summary}</span> : null}
      {event.reason ? (
        <span className="line-clamp-2 text-muted-foreground text-xs">Reason: {event.reason}</span>
      ) : showSummary ? (
        <span className="text-muted-foreground text-xs">No audit reason</span>
      ) : null}
    </div>
  )
}

function AuditMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof History
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate font-semibold text-2xl tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-muted-foreground text-sm">{detail}</div>
    </div>
  )
}

function AuditEventLabel({ eventType }: { eventType: AdminBookingAuditEvent["eventType"] }) {
  const label = auditEventLabel(eventType)
  const variant =
    eventType === "deleted" ? "destructive" : eventType === "updated" ? "secondary" : "outline"

  return <Badge variant={variant}>{label}</Badge>
}

function AuditListHeadline({ event }: { event: AdminBookingAuditEvent }) {
  const label = auditEventSentence(event)
  const accentClass =
    event.eventType === "deleted"
      ? "bg-destructive"
      : event.eventType === "updated"
        ? "bg-primary"
        : "bg-muted-foreground"

  return (
    <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
      <span className={cn("size-2 rounded-full", accentClass)} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function AuditSkeleton() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 5 }, (_, index) => `audit-skeleton-${index}`).map((key) => (
        <div key={key} className="grid gap-2 rounded-md border border-border p-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      ))}
    </div>
  )
}

function openAuditBooking(
  workspace: ReturnType<typeof useWorkspace>,
  event: AdminBookingAuditEvent,
) {
  if (event.booking.deletedAt) {
    return
  }

  workspace.setSelectedMachineSlug(event.machine.slug)
  workspace.editBooking(event.booking)
}

function filterAuditEvents(
  events: AdminBookingAuditEvent[],
  filters: { eventFilter: AuditEventFilter; search: string },
) {
  const normalizedSearch = filters.search.trim().toLowerCase()

  return events.filter((event) => {
    if (filters.eventFilter !== "all" && event.eventType !== filters.eventFilter) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return auditSearchText(event).includes(normalizedSearch)
  })
}

function auditSearchText(event: AdminBookingAuditEvent) {
  return [
    event.booking.title,
    event.booking.id,
    event.reason,
    event.actor.name,
    event.actor.email,
    event.owner.name,
    event.owner.email,
    event.machine.name,
    event.machine.slug,
    event.eventType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function getAuditMetrics(events: AdminBookingAuditEvent[]) {
  const latest = events[0]

  return {
    updated: events.filter((event) => event.eventType === "updated").length,
    deleted: events.filter((event) => event.eventType === "deleted").length,
    latestActor: latest?.actor.name ?? "None",
    latestAt: latest ? formatDateTime(latest.createdAt) : "No events yet",
  }
}

function auditEventLabel(eventType: AdminBookingAuditEvent["eventType"]) {
  switch (eventType) {
    case "created":
      return "Created"
    case "updated":
      return "Updated"
    case "deleted":
      return "Deleted"
    case "admin_override":
      return "Override"
  }
}

function auditEventSentence(event: AdminBookingAuditEvent) {
  const snapshot = getEventBookingSnapshot(event)
  const noun = snapshot.type === "maintenance" ? "maintenance block" : "booking"

  switch (event.eventType) {
    case "created":
      return `Created ${noun}`
    case "updated":
      return `Updated ${noun}`
    case "deleted":
      return `Removed ${noun}`
    case "admin_override":
      return `Admin override for ${noun}`
  }
}

function describeAuditEvent(event: AdminBookingAuditEvent) {
  if (event.eventType === "created") {
    return "Booking created"
  }
  if (event.eventType === "deleted") {
    return "Removed from the schedule"
  }
  if (event.eventType === "admin_override") {
    return "Admin override recorded"
  }

  const changed = changedBookingFields(event.payload)
  return changed.length ? `Changed ${changed.join(", ")}` : "Booking details changed"
}

function getEventBookingSnapshot(event: AdminBookingAuditEvent) {
  const payload = event.payload
  const snapshot = isUpdatePayload(payload) ? payload.after : isObjectRecord(payload) ? payload : {}

  return {
    title: getStringField(snapshot, "title") ?? event.booking.title,
    type: getStringField(snapshot, "type") === "maintenance" ? "maintenance" : event.booking.type,
    startsAt: getStringField(snapshot, "startsAt") ?? event.booking.startsAt,
    endsAt: getStringField(snapshot, "endsAt") ?? event.booking.endsAt,
  }
}

function changedBookingFields(payload: unknown) {
  if (!isUpdatePayload(payload)) {
    return []
  }

  const fields: string[] = []
  if (payload.before.title !== payload.after.title) {
    fields.push("title")
  }
  if (payload.before.userId !== payload.after.userId) {
    fields.push("owner")
  }
  if (payload.before.machineId !== payload.after.machineId) {
    fields.push("machine")
  }
  if (payload.before.type !== payload.after.type) {
    fields.push("type")
  }
  if (
    payload.before.startsAt !== payload.after.startsAt ||
    payload.before.endsAt !== payload.after.endsAt
  ) {
    fields.push("time")
  }
  if (payload.before.notes !== payload.after.notes) {
    fields.push("notes")
  }

  return fields
}

function isUpdatePayload(payload: unknown): payload is {
  before: Record<string, unknown>
  after: Record<string, unknown>
} {
  return (
    isObjectRecord(payload) &&
    "before" in payload &&
    "after" in payload &&
    isObjectRecord(payload.before) &&
    isObjectRecord(payload.after)
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "string" ? value : null
}
