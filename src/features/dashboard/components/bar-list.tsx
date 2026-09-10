/**
 * Ranked-magnitude bar list — sequential (one hue) encoding for "compare magnitude, high to low"
 * (top products, sales by category). Not categorical: these rows aren't distinct series being told
 * apart, they're one measure ranked, so a single hue is the correct color job (see dataviz skill,
 * choosing-a-form.md). Bars are capped at 8px thick, 4px rounded data-end, grow from a single
 * left baseline; value sits at the tip since it's a bar (not a column).
 *
 * Each row is two lines: `rank · name · value` on top, the bar beneath it. The values form a
 * single right-aligned column the eye can scan straight down, which is also the one place in
 * this component where `tabular-nums` belongs — these digits DO align vertically.
 */
import { Link } from 'react-router'
import { cn } from '@/lib/utils/cn'

export interface BarListItem {
  key: string
  label: string
  sublabel?: string
  value: number
  valueLabel: string
  /** Optional destination — rows link to the underlying record where one exists. */
  href?: string
}

export interface BarListProps {
  items: BarListItem[]
  /** Names the measure the bars encode, for assistive tech (e.g. "units sold"). */
  measureLabel?: string
}

export function BarList({ items, measureLabel = 'value' }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <ol className="flex flex-col gap-1">
      {items.map((item, index) => {
        const pct = (item.value / max) * 100
        const row = (
          <>
            {/*
              Rank, name and value share the top line; the bar sits directly beneath as a
              full-width track. Putting the bar in its own column beside the name strands
              it against the card's right edge on a wide screen, far from the label it
              belongs to — the eye then has to cross a gap of empty card to connect them.
            */}
            <span className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="w-3 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {item.label}
              </span>
              {/* Hidden on a phone: the ranking measure and the name have to fit first,
                  and the revenue is the secondary figure of the two. */}
              {item.sublabel && (
                <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline">
                  {item.sublabel}
                </span>
              )}
              <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                {item.valueLabel}
              </span>
            </span>

            {/*
              The track is capped rather than full-bleed: on a wide card an uncapped bar
              turns the top rank into a slab of solid colour spanning the whole page, which
              reads as a progress bar at 100% instead of one magnitude among several. The
              cap keeps the comparison — every bar still shares one baseline and one scale —
              while leaving the row mostly air. `min-width` keeps a near-zero value visible
              as a sliver rather than vanishing, which would read as "no data" rather than
              "very little". Indented to clear the rank gutter so bars align with the names.
            */}
            <span className="ml-5 block h-1.5 max-w-lg overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </span>
          </>
        )

        const rowClass = 'flex flex-col gap-1.5 rounded-md px-2 py-2'

        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  rowClass,
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                )}
                aria-label={`${item.label} — ${item.valueLabel} ${measureLabel}`}
              >
                {row}
              </Link>
            ) : (
              <div className={rowClass}>{row}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
