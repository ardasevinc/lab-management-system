import { labConfig } from "@lab/config"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  CalendarDays,
  Cpu,
  Home,
  LogOut,
  MonitorCog,
  PanelLeft,
  Plus,
  Settings,
  UsersRound,
  Wrench,
} from "lucide-react"
import { useWorkspace } from "@/components/app-workspace"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { User } from "@/lib/api"

const calendarSkeletonCells = Array.from({ length: 72 }, (_, index) => `calendar-cell-${index}`)

export function AppShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdmin = user.role === "admin"

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Cpu aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate font-semibold text-sm">{labConfig.shortName}</div>
              <div className="truncate text-muted-foreground text-xs">{labConfig.appTitle}</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem
                  to="/schedule"
                  label="Schedule"
                  icon={CalendarDays}
                  active={pathname === "/schedule"}
                />
                <NavItem
                  to="/machines"
                  label="Machines"
                  icon={MonitorCog}
                  active={pathname.startsWith("/machines")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdmin ? (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavItem
                      to="/admin"
                      label="Overview"
                      icon={Home}
                      active={pathname === "/admin"}
                    />
                    <NavItem
                      to="/admin/users"
                      label="Users"
                      icon={UsersRound}
                      active={pathname.startsWith("/admin/users")}
                    />
                    <NavItem
                      to="/admin/machines"
                      label="Machines"
                      icon={Settings}
                      active={pathname.startsWith("/admin/machines")}
                    />
                    <NavItem
                      to="/admin/maintenance"
                      label="Maintenance"
                      icon={Wrench}
                      active={pathname.startsWith("/admin/maintenance")}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <AccountMenu user={user} onLogout={onLogout} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-border border-b bg-background/94 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{getRouteLabel(pathname)}</div>
              <div className="truncate text-muted-foreground text-xs">
                {labConfig.defaultTimezone}
              </div>
            </div>
          </div>
          <QuickBookingButton />
        </header>

        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function QuickBookingButton() {
  const { openNewBooking } = useWorkspace()

  return (
    <Button type="button" size="sm" onClick={openNewBooking}>
      <Plus data-icon="inline-start" aria-hidden="true" />
      New booking
    </Button>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string
  label: string
  icon: typeof CalendarDays
  active: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={to}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const initials = getInitials(user.name || user.email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto justify-start gap-2 px-2 py-2">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left group-data-[collapsible=icon]:hidden">
            <div className="truncate font-medium text-sm">{user.name}</div>
            <div className="truncate text-muted-foreground text-xs">{user.email}</div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-64">
        <DropdownMenuLabel className="p-2">
          <div className="grid gap-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate font-medium">{user.name}</span>
              <Badge variant="outline" className="capitalize">
                {user.role}
              </Badge>
            </div>
            <div className="truncate text-muted-foreground text-xs">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut data-icon="inline-start" aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function WorkspaceBootstrap() {
  return (
    <main className="min-h-screen bg-background text-foreground" aria-label="Loading workspace">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-border border-r bg-sidebar p-3 md:block">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <PanelLeft aria-hidden="true" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-6 grid gap-2">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between border-border border-b px-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-28" />
          </header>
          <div className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-6 w-44 rounded-full" />
            </div>
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex min-h-11 items-center justify-between border-border border-b bg-muted/40 px-3 py-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="calendar-frame h-[620px]">
                <div className="grid h-full grid-cols-[52px_repeat(7,minmax(96px,1fr))] grid-rows-[36px_repeat(8,56px)] overflow-hidden">
                  {calendarSkeletonCells.map((cell) => (
                    <div key={cell} className="border-border border-r border-b" />
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

function getRouteLabel(pathname: string) {
  if (pathname.startsWith("/admin/users")) {
    return "Users"
  }
  if (pathname.startsWith("/admin/machines")) {
    return "Admin machines"
  }
  if (pathname.startsWith("/admin/maintenance")) {
    return "Maintenance"
  }
  if (pathname === "/admin") {
    return "Admin overview"
  }
  if (pathname.startsWith("/machines")) {
    return "Machines"
  }
  return "Schedule"
}

function getInitials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
