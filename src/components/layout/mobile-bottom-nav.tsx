import { Link, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { getVisibleMobileNavItems } from '@/routes/nav-config'
import { useSessionStore } from '@/lib/store/session-store'
import { useUiStore } from '@/lib/store/ui-store'
import { usePulseValue } from '@/lib/realtime/use-realtime'
import { cn } from '@/lib/utils/cn'

/** The item that carries the live pending-orders count, as in the sidebar. */
const PENDING_BADGE_PATH = '/sales/orders'

/**
 * The phone's navigation: the four screens a merchant reaches for most, plus
 * More, which opens the full menu drawer. Shown below `lg` — exactly where the
 * sidebar is hidden — so a screen never carries both.
 *
 * The items and their role rules come from `nav-config.ts`, derived from the
 * sidebar's own entries. More is not a route: it opens the same drawer the
 * top-bar hamburger used to, which is why that hamburger is gone.
 *
 * The height is `--admin-bottom-nav-height` (index.css), which `<main>` and the
 * settings save bar also read. Change it there, never here.
 *
 * See server/openspec/changes/add-admin-mobile-shell.
 */
export function MobileBottomNav() {
  const role = useSessionStore((s) => s.user?.role ?? 'STAFF')
  const { pathname } = useLocation()
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const pendingOrders = usePulseValue()?.pendingOrderCount ?? 0

  const items = getVisibleMobileNavItems(role)
  // More is current wherever none of the four is — so exactly one item is
  // always lit, and a merchant deep in SEO settings can see where they are.
  const moreCurrent = !items.some((item) => item.matches(pathname))

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-(--admin-bottom-nav-height) items-stretch">
        {items.map(({ label, path, icon: Icon, matches }) => {
          const current = matches(pathname)
          const showBadge = path === PENDING_BADGE_PATH && pendingOrders > 0

          return (
            <li key={path} className="flex-1">
              <Link
                to={path}
                aria-current={current ? 'page' : undefined}
                className={cn(itemClass, current ? 'text-primary' : 'text-muted-foreground')}
              >
                <span className="relative">
                  <Icon className="size-[22px]" aria-hidden />
                  {showBadge && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                      {pendingOrders > 99 ? '99+' : pendingOrders}
                    </span>
                  )}
                </span>
                {label}
                {showBadge && <span className="sr-only">, {pendingOrders} pending</span>}
              </Link>
            </li>
          )
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-haspopup="dialog"
            className={cn(itemClass, moreCurrent ? 'text-primary' : 'text-muted-foreground')}
          >
            <Menu className="size-[22px]" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

const itemClass =
  'flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
