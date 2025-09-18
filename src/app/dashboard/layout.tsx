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
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <DynamicBreadcrumbs />
            </div>

            {/* Уведомления и тема в правом углу */}
            <div className="flex items-center gap-2 px-4 ml-auto">
              <ThemeToggle />
              <NotificationsDropdown />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
        </SidebarProvider>
      </div>
    </AuthGuard>
  )
}
