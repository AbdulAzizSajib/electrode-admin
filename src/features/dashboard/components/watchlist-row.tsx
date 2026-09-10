import { Link } from 'react-router'
import type { ReactNode } from 'react'

/**
 * One row of the dashboard's two watchlists (Recent Orders, Low Stock).
 *
 * Shared rather than duplicated because the two lists had already drifted apart:
 * both were hand-built `<Link>`s with the same intent, but only one carried a
 * secondary line and neither had a focus ring, so keyboard users could tab through
 * either list with nothing visible moving. Anything that is true of one of these
 * rows is true of the other, so there is one implementation.
 *
 * `focus-visible` uses a ring plus an offset in the SURFACE colour: these rows sit on
 * a card, not on the page background, so an offset ring drawn against `--color-background`
 * would show a sliver of the wrong colour between row and ring.
 */
export interface WatchlistRowProps {
  to: string
  title: string
  subtitle?: string
  /** Right-hand side — a badge, an amount, or both. */
  trailing: ReactNode
}

export function WatchlistRow({ to, title, subtitle, trailing }: WatchlistRowProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 pl-1">{trailing}</span>
    </Link>
  )
}
