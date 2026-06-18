import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { AuthScreen } from "@/components/auth-screen"
import { getStoredToken } from "@/lib/api"

export const Route = createFileRoute("/login")({
  component: LoginRoute,
})

function LoginRoute() {
  const navigate = useNavigate()

  if (getStoredToken()) {
    return <Navigate to="/schedule" replace />
  }

  return (
    <AuthScreen
      onLoggedIn={(user) => {
        navigate({ to: user.role === "admin" ? "/admin" : "/schedule", replace: true })
      }}
    />
  )
}
