import { createFileRoute } from "@tanstack/react-router"
import { AdminMachinesPage } from "@/components/admin-pages"

export const Route = createFileRoute("/_authenticated/admin/machines")({
  component: AdminMachinesPage,
})
