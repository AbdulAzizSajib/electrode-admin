import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'
import { BreadcrumbLabelProvider } from '@/components/layout/breadcrumb-context'
import { useCurrencyFormatSync } from '@/components/providers/currency-format-provider'
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

  /*
   * Applied here rather than higher up because `/settings` is an authenticated read — this layout
   * is the first thing that renders behind the auth guard. See the hook for why the key is needed
   * at all: `formatCurrency` reads module state, which nothing re-renders on its own.
   */
  const currencyKey = useCurrencyFormatSync()

  return (
    <BreadcrumbLabelProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 lg:flex',
            sidebarCollapsed ? 'w-16' : 'w-76',
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
          <SheetContent side="left" className="w-76 max-w-[80vw] bg-sidebar p-0">
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
          {/* Keyed on the currency format so the routed page re-renders its
              amounts the moment the merchant's settings arrive — at most once
              per session, before anything has been typed. */}
          <main key={currencyKey} className="flex-1 overflow-y-auto p-4">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </BreadcrumbLabelProvider>
  )
}
