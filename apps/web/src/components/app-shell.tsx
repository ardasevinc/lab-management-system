import { labConfig } from "@lab/config"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  CalendarDays,
  ChevronsUpDown,
  Cpu,
  Home,
  LogOut,
  MonitorCog,
  PanelLeft,
  Plus,
  Settings,
  UsersRound,
  Wrench,
  X,
} from "lucide-react"
import { useWorkspace } from "@/components/app-workspace"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
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
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { User } from "@/lib/api"

const calendarSkeletonCells = Array.from({ length: 72 }, (_, index) => `calendar-cell-${index}`)

export function AppShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { clearWorkspaceError, selectedMachine, workspaceError } = useWorkspace()
  const isAdmin = user.role === "admin"
  const routeInfo = getRouteInfo(pathname)

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="px-3 pt-3 pb-1.5">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Cpu aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate font-semibold text-[0.92rem] leading-5">
                {labConfig.shortName}
              </div>
              <div className="truncate text-muted-foreground text-xs leading-4">
                {labConfig.appTitle}
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-1.5 px-3 py-1">
          <SidebarGroup className="gap-1 px-0 py-1.5">
            <SidebarGroupLabel className="h-5 px-2 text-[0.7rem] tracking-normal">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
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
              <SidebarSeparator className="my-1" />
              <SidebarGroup className="gap-1 px-0 py-1.5">
                <SidebarGroupLabel className="h-5 px-2 text-[0.7rem] tracking-normal">
                  Admin
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
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

        <SidebarFooter className="px-3 pb-3">
          <AccountMenu user={user} onLogout={onLogout} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-border border-b bg-background/94 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <RouteBreadcrumb routeInfo={routeInfo} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selectedMachine ? (
              <Badge variant="outline" className="hidden max-w-40 truncate sm:inline-flex">
                {selectedMachine.name}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="hidden md:inline-flex">
              {labConfig.defaultTimezone}
            </Badge>
            <HeaderAction pathname={pathname} />
          </div>
        </header>

        {workspaceError ? (
          <div className="px-3 pt-3 sm:px-4">
            <Alert variant="destructive">
              <AlertTitle>Could not save changes</AlertTitle>
              <AlertDescription>{workspaceError}</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Dismiss"
                  onClick={clearWorkspaceError}
                >
                  <X aria-hidden="true" />
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : null}

        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function RouteBreadcrumb({ routeInfo }: { routeInfo: RouteInfo }) {
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden">
        <BreadcrumbItem className="hidden shrink-0 sm:inline-flex">
          <BreadcrumbLink asChild>
            <Link to={routeInfo.sectionTo}>{routeInfo.section}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden shrink-0 sm:inline-flex" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="block truncate font-medium">{routeInfo.page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function HeaderAction({ pathname }: { pathname: string }) {
  if (pathname !== "/schedule") {
    return null
  }

  return <QuickBookingButton />
}

function QuickBookingButton() {
  const { openNewBooking } = useWorkspace()

  return (
    <Button
      type="button"
      size="sm"
      className="hidden lg:inline-flex"
      onClick={openNewBooking}
      aria-label="New booking"
    >
      <Plus data-icon="inline-start" aria-hidden="true" />
      <span>New booking</span>
    </Button>
  )
}

type RouteInfo = {
  section: string
  sectionTo: string
  page: string
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
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className="h-8 rounded-md px-2 font-normal text-[0.875rem] text-sidebar-foreground/78 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
      >
        <Link
          to={to}
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false)
            }
          }}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const initials = getInitials(user.name || user.email)
  const { isMobile } = useSidebar()
  const menuSide = isMobile ? "top" : "right"
  const displayName = user.name || user.email
  const roleLabel = user.role === "admin" ? "Admin" : "Member"

  return (
    <DropdownMenu>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-11 rounded-lg px-2.5 text-sidebar-foreground/88 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar size="default">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium text-sm leading-5">{displayName}</span>
                <span className="truncate text-muted-foreground text-xs leading-4">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown
                className="ml-auto group-data-[collapsible=icon]:hidden"
                aria-hidden="true"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
        </SidebarMenuItem>
      </SidebarMenu>
      <DropdownMenuContent
        align="end"
        side={menuSide}
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1.5rem)] rounded-xl p-2"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex min-w-0 items-start gap-3 rounded-lg px-2 py-2.5">
              <Avatar size="lg">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-1 text-left">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-sm text-popover-foreground">
                    {displayName}
                  </span>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {roleLabel}
                  </Badge>
                </div>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <div className="grid gap-1 px-1 py-1">
            <AccountMetaRow label="Name" value={displayName} />
            <AccountMetaRow label="Email" value={user.email} />
            <AccountMetaRow label="Timezone" value={labConfig.defaultTimezone} />
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onLogout} variant="destructive" className="h-9 rounded-lg">
            <LogOut data-icon="inline-start" aria-hidden="true" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-right font-medium text-xs">{value}</span>
    </div>
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

function getRouteInfo(pathname: string): RouteInfo {
  if (pathname.startsWith("/admin/users")) {
    return { section: "Admin", sectionTo: "/admin", page: "Users" }
  }
  if (pathname.startsWith("/admin/machines")) {
    return { section: "Admin", sectionTo: "/admin", page: "Machines" }
  }
  if (pathname.startsWith("/admin/maintenance")) {
    return { section: "Admin", sectionTo: "/admin", page: "Maintenance" }
  }
  if (pathname === "/admin") {
    return { section: "Admin", sectionTo: "/admin", page: "Overview" }
  }
  if (pathname.startsWith("/machines")) {
    return { section: "Workspace", sectionTo: "/schedule", page: "Machines" }
  }
  return { section: "Workspace", sectionTo: "/schedule", page: "Schedule" }
}

function getInitials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
