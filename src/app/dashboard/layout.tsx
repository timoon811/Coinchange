import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { AuthGuard } from "@/components/auth-guard"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcrumbs"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 px-6 border-b border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-6" />
              <DynamicBreadcrumbs />
            </div>

            {/* Уведомления и тема в правом углу */}
            <div className="flex items-center gap-3 ml-auto">
              <ThemeToggle />
              <NotificationsDropdown />
            </div>
          </header>
          <div className="flex flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
        </SidebarProvider>
      </div>
    </AuthGuard>
  )
}
