import { createFileRoute, redirect } from "@tanstack/react-router"
import { AppWorkspace } from "@/components/app-workspace"
import { getCurrentSession } from "@/lib/api"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getCurrentSession()

    if (!session.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AppWorkspace,
})
