import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'
import { BreadcrumbLabelProvider } from '@/components/layout/breadcrumb-context'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUiStore } from '@/lib/store/ui-store'
import { cn } from '@/lib/utils/cn'

function RouteFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}

export function ShellLayout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)

  return (
    <BreadcrumbLabelProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background border-red-700 border-2">
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 lg:flex',
            sidebarCollapsed ? 'w-16' : 'w-60',
          )}
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              E
            </div>
            {!sidebarCollapsed && <span className="text-sm font-semibold text-white">Ecom Admin</span>}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <SidebarNav collapsed={sidebarCollapsed} />
          </div>
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-64 max-w-[80vw] bg-sidebar p-0">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                E
              </div>
              <span className="text-sm font-semibold text-white">Ecom Admin</span>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </BreadcrumbLabelProvider>
  )
}
