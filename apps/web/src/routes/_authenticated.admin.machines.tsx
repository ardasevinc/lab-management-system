import { createFileRoute } from "@tanstack/react-router"
import { AdminMachinesPage } from "@/components/admin-machines-page"

export const Route = createFileRoute("/_authenticated/admin/machines")({
  component: AdminMachinesPage,
})
