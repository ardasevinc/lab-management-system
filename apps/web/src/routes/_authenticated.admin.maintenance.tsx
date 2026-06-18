import { createFileRoute } from "@tanstack/react-router"
import { AdminMaintenancePage } from "@/components/admin-pages"

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  component: AdminMaintenancePage,
})
