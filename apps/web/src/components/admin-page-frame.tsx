import { cn } from "@/lib/utils"

export function AdminPageFrame({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="min-w-0 p-3 sm:p-4">
      <div
        className={cn(
          "flex items-center justify-end gap-3 sm:mb-4 sm:items-end sm:justify-between",
          action ? "mb-3" : "mb-0",
        )}
      >
        <div className="sr-only sm:not-sr-only">
          <h1 className="font-semibold text-xl tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 hidden text-muted-foreground text-sm sm:block">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </main>
  )
}
