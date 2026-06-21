import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { AuditEvent, User } from "@/lib/api"
import { formatDateTime } from "@/lib/time"

type BookingAuditHistoryProps = {
  events?: AuditEvent[]
  loading: boolean
  users: User[]
}

export function BookingAuditHistory({ events, loading, users }: BookingAuditHistoryProps) {
  return (
    <section
      aria-labelledby="booking-audit-history-title"
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="booking-audit-history-title" className="font-medium text-sm">
          Audit history
        </h3>
        {loading ? (
          <Badge variant="secondary">Loading</Badge>
        ) : (
          <Badge variant="outline">{events?.length ?? 0}</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : events?.length ? (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 rounded-md bg-background px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatAuditAction(event.eventType)}</Badge>
                <span className="font-medium text-sm">
                  {formatAuditActor(event.actorUserId, users)}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">{formatDateTime(event.createdAt)}</div>
              {event.reason ? (
                <div className="text-muted-foreground text-xs">Reason: {event.reason}</div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No audit events yet.</p>
      )}
    </section>
  )
}

function formatAuditAction(eventType: AuditEvent["eventType"]) {
  switch (eventType) {
    case "created":
      return "Created"
    case "updated":
      return "Updated"
    case "deleted":
      return "Deleted"
    case "admin_override":
      return "Admin override"
  }
}

function formatAuditActor(actorUserId: string, users: User[]) {
  const user = users.find((candidate) => candidate.id === actorUserId)

  if (user) {
    return `${user.name} · ${user.email}`
  }

  return `Unknown user · ${actorUserId}`
}
