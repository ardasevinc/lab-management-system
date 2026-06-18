import { createFileRoute, redirect } from "@tanstack/react-router"
import { AppWorkspace } from "@/components/app-workspace"
import { getStoredToken } from "@/lib/api"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (!getStoredToken()) {
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
