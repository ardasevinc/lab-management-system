import { createFileRoute } from "@tanstack/react-router"
import { SchedulePage } from "@/components/schedule-page"

export const Route = createFileRoute("/_authenticated/schedule")({
  component: SchedulePage,
})
