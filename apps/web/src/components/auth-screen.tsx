import { labConfig } from "@lab/config"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, KeyRound, Mail } from "lucide-react"
import { useState } from "react"
import { BrandMark } from "@/components/brand-mark"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { requestOtp, type User, verifyOtp } from "@/lib/api"

type AuthScreenProps = {
  initialEmail?: string
  onLoggedIn: (user: User) => void
}

export function AuthScreen({ initialEmail = "", onLoggedIn }: AuthScreenProps) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"email" | "code">("email")

  const requestMutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: (result) => {
      setDevCode(result.devCode ?? null)
      setCode(result.devCode ?? "")
      setError(null)
      setStep("code")
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(email, code),
    onSuccess: (session) => {
      setError(null)
      onLoggedIn(session.user)
    },
    onError: (mutationError) => setError(mutationError.message),
  })

  const isBusy = requestMutation.isPending || verifyMutation.isPending

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07100f] text-white">
      <div className="auth-background" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,9,0.72),rgba(3,7,9,0.42)_48%,rgba(3,7,9,0.62))]" />

      <section className="relative z-10 grid min-h-[100dvh] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:p-8">
        <div className="hidden min-h-0 flex-col justify-between py-2 pr-10 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark className="size-9 shadow-sm" />
            <div>
              <p className="font-medium text-white/50 text-xs uppercase tracking-[0.18em]">
                {labConfig.shortName}
              </p>
              <h1 className="font-semibold text-lg leading-none">{labConfig.appTitle}</h1>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="font-medium text-white/52 text-sm uppercase tracking-[0.18em]">Tohum</p>
            <h2 className="mt-3 max-w-lg font-semibold text-4xl leading-tight tracking-tight">
              MIRALAB machine access.
            </h2>
          </div>

          <div className="h-px max-w-xl bg-white/12" />
        </div>

        <div className="grid min-h-[calc(100dvh-2rem)] place-items-center lg:min-h-full">
          <div className="auth-panel w-full max-w-[408px] rounded-xl border p-5 text-card-foreground shadow-2xl sm:p-6">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <BrandMark className="mb-4 size-10 shadow-sm lg:hidden" />
                <p className="font-medium text-muted-foreground text-sm">{labConfig.shortName}</p>
                <h2 className="font-semibold text-2xl tracking-tight">{labConfig.appTitle}</h2>
              </div>
              <div className="rounded-full border bg-muted px-2.5 py-1 text-muted-foreground text-xs">
                OTP
              </div>
            </div>

            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (step === "email") {
                  requestMutation.mutate(email)
                  return
                }

                verifyMutation.mutate()
              }}
            >
              {step === "email" ? (
                <FieldGroup>
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="email"
                        className="pl-9"
                        type="email"
                        name="email"
                        placeholder="you@lab.edu"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value)
                          setError(null)
                        }}
                        autoComplete="email"
                        spellCheck={false}
                        required
                        aria-invalid={error ? true : undefined}
                      />
                    </div>
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                </FieldGroup>
              ) : (
                <FieldGroup>
                  <Field>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <FieldLabel htmlFor="code">Login code</FieldLabel>
                        <FieldDescription className="truncate">{email}</FieldDescription>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => {
                          setStep("email")
                          setCode("")
                          setDevCode(null)
                          setError(null)
                        }}
                      >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Change
                      </Button>
                    </div>
                  </Field>

                  <Field data-invalid={error ? true : undefined}>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="code"
                        className="pl-9 font-mono tracking-[0.18em]"
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(event) => {
                          setCode(event.target.value)
                          setError(null)
                        }}
                        autoFocus
                        required
                        aria-invalid={error ? true : undefined}
                      />
                    </div>
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                </FieldGroup>
              )}

              {step === "code" && devCode ? (
                <Alert>
                  <AlertTitle>Local development code</AlertTitle>
                  <AlertDescription>
                    <span className="font-mono">{devCode}</span>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={isBusy}>
                {step === "email"
                  ? requestMutation.isPending
                    ? "Sending code"
                    : "Continue"
                  : verifyMutation.isPending
                    ? "Signing in"
                    : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}

export function AuthBootstrap() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07100f] text-white">
      <div className="auth-background" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,9,0.72),rgba(3,7,9,0.42)_48%,rgba(3,7,9,0.62))]" />

      <section className="relative z-10 grid min-h-[100dvh] p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:p-8">
        <div className="hidden min-h-0 flex-col justify-between py-2 pr-10 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark className="size-9 shadow-sm" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16 bg-white/15" />
              <Skeleton className="h-4 w-24 bg-white/18" />
            </div>
          </div>

          <div className="max-w-xl space-y-3">
            <Skeleton className="h-3 w-16 bg-white/15" />
            <Skeleton className="h-9 max-w-lg bg-white/18" />
          </div>

          <div className="h-px max-w-xl bg-white/12" />
        </div>

        <div className="grid min-h-[calc(100dvh-2rem)] place-items-center lg:min-h-full">
          <div className="auth-panel w-full max-w-[408px] rounded-xl border p-5 text-card-foreground shadow-2xl sm:p-6">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="space-y-3">
                <BrandMark className="size-10 shadow-sm lg:hidden" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-32" />
              </div>
              <Skeleton className="h-7 w-12 rounded-full" />
            </div>

            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
