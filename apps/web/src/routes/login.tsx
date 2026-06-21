import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { AuthScreen } from "@/components/auth-screen"
import { getStoredToken } from "@/lib/api"

export const Route = createFileRoute("/login")({
  component: LoginRoute,
})

function LoginRoute() {
  const navigate = useNavigate()
  const redirect = getLoginRedirect()
  const initialEmail = getLoginEmail()

  if (getStoredToken()) {
    return <Navigate to={redirect ?? "/schedule"} replace />
  }

  return (
    <AuthScreen
      initialEmail={initialEmail}
      onLoggedIn={(user) => {
        navigate({
          to: redirect ?? (user.role === "admin" ? "/admin" : "/schedule"),
          replace: true,
        })
      }}
    />
  )
}

function getLoginEmail() {
  const value = new URLSearchParams(globalThis.location?.search).get("email")
  return sanitizeEmail(value)
}

function getLoginRedirect() {
  return sanitizeRedirect(new URLSearchParams(globalThis.location?.search).get("redirect"))
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed.toLowerCase() : undefined
}

function sanitizeRedirect(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined
  }

  if (value.startsWith("/login")) {
    return undefined
  }

  return value
}
