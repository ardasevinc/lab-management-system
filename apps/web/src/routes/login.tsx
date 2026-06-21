import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { AuthBootstrap, AuthScreen } from "@/components/auth-screen"
import { getCurrentSession, type User } from "@/lib/api"

export const Route = createFileRoute("/login")({
  component: LoginRoute,
})

function LoginRoute() {
  const navigate = useNavigate()
  const redirect = getLoginRedirect()
  const initialEmail = getLoginEmail()
  const meQuery = useQuery({
    queryKey: ["login-me"],
    queryFn: getCurrentSession,
    retry: false,
  })

  if (meQuery.data?.user) {
    return <Navigate to={redirect ?? routeForUser(meQuery.data.user)} replace />
  }

  if (!meQuery.data) {
    return <AuthBootstrap />
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

function routeForUser(user: User) {
  return user.role === "admin" ? "/admin" : "/schedule"
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
