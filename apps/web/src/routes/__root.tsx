import { labConfig } from "@lab/config"
import { createRootRoute, Link, Outlet, useRouter } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, Home, RotateCcw } from "lucide-react"
import type { ReactNode } from "react"
import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"

export const Route = createRootRoute({
  component: Outlet,
  errorComponent: RootError,
  notFoundComponent: NotFound,
})

function RootError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()

  return (
    <RootRouteSurface
      eyebrow="Recovery"
      title="Something broke in this workspace."
      description="The app kept the route state, but this screen failed to render. Try the route again or return to the schedule."
      icon={AlertTriangle}
      actions={
        <>
          <Button
            type="button"
            onClick={() => {
              reset()
              router.invalidate()
            }}
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/schedule">
              <Home data-icon="inline-start" aria-hidden="true" />
              Schedule
            </Link>
          </Button>
        </>
      }
    >
      {import.meta.env.DEV ? (
        <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/45 p-3 text-muted-foreground text-xs">
          {error.message}
        </pre>
      ) : null}
    </RootRouteSurface>
  )
}

function NotFound() {
  return (
    <RootRouteSurface
      eyebrow="404"
      title="Page not found."
      description="This route is not part of the lab workspace. Go back or open the schedule."
      icon={ArrowLeft}
      actions={
        <>
          <Button variant="outline" type="button" onClick={() => window.history.back()}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Back
          </Button>
          <Button asChild>
            <Link to="/schedule">
              <Home data-icon="inline-start" aria-hidden="true" />
              Schedule
            </Link>
          </Button>
        </>
      }
    />
  )
}

function RootRouteSurface({
  actions,
  children,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  actions: ReactNode
  children?: ReactNode
  description: string
  eyebrow: string
  icon: typeof AlertTriangle
  title: string
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10 shrink-0 shadow-sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{labConfig.shortName}</p>
            <p className="truncate text-muted-foreground text-xs">{labConfig.appTitle}</p>
          </div>
        </div>

        <div className="mt-8 flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.08em]">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-balance font-semibold text-2xl tracking-tight">{title}</h1>
            <p className="mt-2 max-w-md text-muted-foreground text-sm leading-6">{description}</p>
          </div>
        </div>

        {children ? <div className="mt-5">{children}</div> : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </section>
    </main>
  )
}
