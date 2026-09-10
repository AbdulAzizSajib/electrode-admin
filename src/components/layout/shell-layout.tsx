import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { ShellBrand } from '@/components/layout/shell-brand'
import { Topbar } from '@/components/layout/topbar'
import { BreadcrumbLabelProvider } from '@/components/layout/breadcrumb-context'
import { useCurrencyFormatSync } from '@/components/providers/currency-format-provider'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUiStore } from '@/lib/store/ui-store'
import { useAutoHideScrollbar } from '@/lib/hooks/use-auto-hide-scrollbar'
import { useRealtime } from '@/lib/realtime/use-realtime'
import { useOrderAlert, useOrderAlertSound } from '@/lib/realtime/use-order-alert'
import { armAlertSound } from '@/lib/realtime/alert-sound'
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

  /*
   * The panel's single live poll, mounted here because this layout is the first thing behind
   * the auth guard and outlives every routed page — so the poll survives navigation, and one
   * poll serves the dashboard, the pending badge and the notification count alike.
   */
  const pulse = useRealtime()
  const { muted, toggleMuted } = useOrderAlertSound()
  useOrderAlert(pulse, muted)

  /*
   * The panel's scroll regions — the nav, its mobile twin, and the routed page.
   * All three wear `.scrollbar-overlay`, so a bar only appears where the
   * merchant is working instead of two grey stripes sitting there permanently.
   * See the utility in index.css for why hover alone was not enough.
   */
  const sidebarScrollRef = useAutoHideScrollbar<HTMLDivElement>()
  const mobileNavScrollRef = useAutoHideScrollbar<HTMLDivElement>()
  const mainScrollRef = useAutoHideScrollbar<HTMLElement>()

  /*
   * The panel owns the viewport for as long as it is mounted, so the DOCUMENT
   * must not scroll: the shell below is exactly one viewport tall and hands its
   * only scroll region to `<main>`. Without this the document grows a second
   * scrollbar beside that one, and scrolling it slides the whole panel —
   * sidebar and topbar included — up off the screen, leaving a band of bare
   * body background under it.
   *
   * Set here rather than on `html` in index.css because the two routes that
   * render OUTSIDE this layout genuinely need the document to scroll: the
   * sign-in screen centres a card that can outgrow a short window, and the
   * fulfilment documents are long pages that also have to paginate to paper.
   * Unmounting restores whatever was there.
   */
  useEffect(() => {
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'

    return () => {
      html.style.overflow = previous
    }
  }, [])

  return (
    <BreadcrumbLabelProvider>
      {/*
        Any click or keypress in the panel counts as the user gesture browsers
        require before they'll allow audio, so the first order of a session is
        audible rather than silent.

        `fixed inset-0`, not a height in the flow. This box was `h-svh`, which
        is not the same number as the `height: 100%` chain index.css runs down
        html → body → #root: viewport units ignore a classic scrollbar, so the
        panel ended up marginally taller than the space it had, the document
        grew a scrollbar of its own next to `<main>`'s, and scrolling it pushed
        the whole shell off the top of the screen. Taken out of flow it is the
        viewport by definition and contributes no document height at all, so
        neither can come back.
      */}
      <div
        className="fixed inset-0 flex overflow-hidden bg-background"
        onPointerDownCapture={armAlertSound}
        onKeyDownCapture={armAlertSound}
      >
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 lg:flex',
            sidebarCollapsed ? 'w-16' : 'w-76',
          )}
        >
          {/* No `gap` — the lockup is one text node now that the monogram tile
              is gone. Collapsed, the padding comes off so the initial centres in
              the 4rem rail rather than sitting left of centre. */}
          <div
            className={cn(
              'flex h-14 shrink-0 items-center border-b border-sidebar-border',
              sidebarCollapsed ? 'px-0' : 'px-3',
            )}
          >
            <ShellBrand collapsed={sidebarCollapsed} />
          </div>
          <div
            ref={sidebarScrollRef}
            className="scrollbar-overlay scrollbar-overlay-inverted min-h-0 flex-1 overflow-y-auto"
          >
            <SidebarNav collapsed={sidebarCollapsed} />
          </div>
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-76 max-w-[80vw] bg-sidebar p-0">
            <div className="flex h-12 shrink-0 items-center border-b border-sidebar-border px-3">
              <ShellBrand />
            </div>
            <div
              ref={mobileNavScrollRef}
              className="scrollbar-overlay scrollbar-overlay-inverted min-h-0 flex-1 overflow-y-auto py-2"
            >
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar soundMuted={muted} onToggleSound={toggleMuted} />
          {/* Keyed on the currency format so the routed page re-renders its
              amounts the moment the merchant's settings arrive — at most once
              per session, before anything has been typed. */}
          <main
            key={currencyKey}
            ref={mainScrollRef}
            className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto p-4"
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </BreadcrumbLabelProvider>
  )
}
