import { createFileRoute } from "@tanstack/react-router"
import { MachinesPage } from "@/components/machines-page"

export const Route = createFileRoute("/_authenticated/machines")({
  component: MachinesPage,
})
