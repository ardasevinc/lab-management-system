import { createFileRoute } from "@tanstack/react-router"
import { AdminBookingAuditPage } from "@/components/admin-booking-audit-page"

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AdminBookingAuditPage,
})
