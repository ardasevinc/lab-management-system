import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router"
import { AdminOverviewPage } from "@/components/admin-pages"

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminRoute,
})

function AdminRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname === "/admin") {
    return <AdminOverviewPage />
  }

  return <Outlet />
}
