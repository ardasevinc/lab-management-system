import { labConfig } from "@lab/config"
import { machines } from "@lab/domain"
import { CalendarDays, Cpu, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export function App() {
  const primaryMachine = machines[0]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-border border-b pb-6">
          <div>
            <p className="text-muted-foreground text-sm">{labConfig.shortName}</p>
            <h1 className="font-semibold text-3xl tracking-tight">{labConfig.appTitle}</h1>
          </div>
          <Button type="button">
            <CalendarDays className="size-4" />
            New booking
          </Button>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <Cpu className="size-4 text-primary" />
                Machines
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="font-medium">{primaryMachine.name}</div>
                <p className="mt-1 text-muted-foreground text-sm">{primaryMachine.description}</p>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4 text-primary" />
                Access
              </div>
              <p className="text-muted-foreground text-sm">
                Invite-only booking portal. Admins can edit maintenance windows and resolve
                conflicts.
              </p>
            </section>
          </aside>

          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-border border-b p-4">
              <div>
                <h2 className="font-semibold text-lg">{primaryMachine.name} calendar</h2>
                <p className="text-muted-foreground text-sm">
                  Custom booking grid goes here: drag-create, move, resize, then server validation.
                </p>
              </div>
              <Button type="button" variant="outline">
                This week
              </Button>
            </div>
            <div className="grid min-h-[520px] place-items-center p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-primary/10 text-primary">
                  <CalendarDays className="size-6" />
                </div>
                <h3 className="font-medium">Booking board scaffold</h3>
                <p className="mt-2 text-muted-foreground text-sm">
                  The app shell is wired. Next step is the product-specific week grid and booking
                  interaction engine.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
