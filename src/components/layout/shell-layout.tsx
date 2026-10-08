import { Suspense, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Loader2 } from 'lucide-react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { ShellBrand } from '@/components/layout/shell-brand'
import { Topbar } from '@/components/layout/topbar'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { BreadcrumbLabelProvider } from '@/components/layout/breadcrumb-context'
import { useCurrencyFormatSync } from '@/components/providers/currency-format-provider'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUiStore } from '@/lib/store/ui-store'
import { useAutoHideScrollbar } from '@/lib/hooks/use-auto-hide-scrollbar'
import { useRealtime } from '@/lib/realtime/use-realtime'
import { useOrderAlert, useOrderAlertSound } from '@/lib/realtime/use-order-alert'
import { armAlertSound } from '@/lib/realtime/alert-sound'
import { cn } from '@/lib/utils/cn'

/**
 * Whether the viewport is at the sidebar's breakpoint (`lg`, 1024px) or wider —
 * the one switch between the desktop shell and the phone frame. Read through
 * `useSyncExternalStore` so a resize or rotation across it re-renders at once.
 */
const DESKTOP_QUERY = '(min-width: 1024px)'

function subscribeToDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )
}

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
  // The scrollbar hook hands back a callback ref, so the element itself is kept
  // alongside it for the scroll reset below.
  const mainElement = useRef<HTMLElement | null>(null)
  const mainRef = useCallback(
    (el: HTMLElement | null) => {
      mainElement.current = el
      mainScrollRef(el)
    },
    [mainScrollRef],
  )

  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()

  /*
   * Every page opens at its top. Keyed on the PATHNAME only, so paging and
   * filtering a list (query-string changes) keep their place. Whichever element
   * scrolls is the one reset: the window below `lg`, `<main>` from `lg`. Before
   * this, `<main>` kept the previous page's position across navigation.
   * See server/openspec/changes/add-admin-mobile-shell, design.md Decision 8.
   */
  useEffect(() => {
    if (isDesktop) mainElement.current?.scrollTo(0, 0)
    else window.scrollTo(0, 0)
    // `isDesktop` deliberately omitted: rotating the phone is not a navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /*
   * FROM `lg` UP the panel owns the viewport, so the DOCUMENT must not scroll:
   * the shell below is exactly one viewport tall and hands its only scroll
   * region to `<main>`. Without this the document grows a second scrollbar
   * beside that one, and scrolling it slides the whole panel — sidebar and
   * topbar included — up off the screen, leaving a band of bare body
   * background under it.
   *
   * BELOW `lg` THE DOCUMENT SCROLLS, on purpose. A phone browser only collapses
   * its own address and tool bars when the document scrolls; with `<main>` as a
   * nested scroller they stayed expanded on every page, spending 50–100px of a
   * small screen. There is no sidebar below `lg` to slide away, so the reason
   * above does not apply there. See server/openspec/changes/
   * add-admin-mobile-shell, design.md Decision 2.
   *
   * Set here rather than on `html` in index.css because the two routes that
   * render OUTSIDE this layout genuinely need the document to scroll: the
   * sign-in screen centres a card that can outgrow a short window, and the
   * fulfilment documents are long pages that also have to paginate to paper.
   * Unmounting, or crossing below `lg`, restores whatever was there.
   */
  useEffect(() => {
    if (!isDesktop) return
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'

    return () => {
      html.style.overflow = previous
    }
  }, [isDesktop])

  return (
    <BreadcrumbLabelProvider>
      {/*
        Any click or keypress in the panel counts as the user gesture browsers
        require before they'll allow audio, so the first order of a session is
        audible rather than silent.

        `lg:fixed lg:inset-0`, not a height in the flow — and below `lg` neither:
        there the shell is an ordinary block and the document scrolls (see the
        effect above). This box was `h-svh`, which
        is not the same number as the `height: 100%` chain index.css runs down
        html → body → #root: viewport units ignore a classic scrollbar, so the
        panel ended up marginally taller than the space it had, the document
        grew a scrollbar of its own next to `<main>`'s, and scrolling it pushed
        the whole shell off the top of the screen. Taken out of flow it is the
        viewport by definition and contributes no document height at all, so
        neither can come back.
      */}
      <div
        className="flex min-h-svh bg-background lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden"
        onPointerDownCapture={armAlertSound}
        onKeyDownCapture={armAlertSound}
      >
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 lg:flex',
            sidebarCollapsed ? 'w-18' : 'w-72',
          )}
        >
          {/* No `gap` — the lockup is one text node now that the monogram tile
              is gone. Collapsed, the padding comes off so the initial centres in
              the 4rem rail rather than sitting left of centre. */}
          <div
            className={cn(
              'flex h-18 shrink-0 items-center border-b border-sidebar-border',
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

        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <Topbar soundMuted={muted} onToggleSound={toggleMuted} />
          {/* Keyed on the currency format so the routed page re-renders its
              amounts the moment the merchant's settings arrive — at most once
              per session, before anything has been typed. */}
          {/*
            The scroll region from `lg` only. Below it, the bottom padding is the
            room the fixed bottom bar needs — its height, the device's safe area
            and the page's own 1rem — read from the same token the bar uses, so
            the last content of every page stays above the bar.
          */}
          <main
            key={currencyKey}
            ref={mainRef}
            className="scrollbar-overlay flex-1 p-4 pb-[calc(var(--admin-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] lg:min-h-0 lg:overflow-y-auto lg:pb-4"
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* Inside the shell so a tap on it arms the alert sound like any other. */}
        <MobileBottomNav />
      </div>
    </BreadcrumbLabelProvider>
  )
}
