import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

export interface StatCardProps {
  label: string
  value: string
  /** Omit when there's no real trend to show (e.g. no historical basis to compare against) — never fabricate one. */
  trend?: number
  /**
   * What `trend` is measured against, e.g. "vs previous 30 days". Required whenever a
   * trend is shown: a bare "+12.4%" states a comparison without naming its baseline,
   * which the merchant can only guess at (previous period? same period last year?).
   */
  trendLabel?: string
  icon: LucideIcon
}

export function StatCard({ label, value, trend, trendLabel, icon: Icon }: StatCardProps) {
  /*
   * Flat is its own case, not a positive one.
   *
   * `>= 0` painted an unchanged figure success-green with a rising arrow, which claims
   * growth that did not happen — most visible on a store with no sales yet, where every
   * tile read "+0.0%" in green. Zero gets muted ink and no arrow: nothing moved.
   */
  const flat = trend === 0
  const positive = (trend ?? 0) > 0
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {/*
            Proportional figures deliberately — `tabular-nums` gives every digit the
            width of a `0`, which makes a value like `121` read loose at this size.
            Tabular is for columns that align vertically (table rows, axis ticks);
            these four tiles sit side by side and never align digit-to-digit.
          */}
          <span className="truncate text-xl font-semibold text-foreground">{value}</span>
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                flat ? 'text-muted-foreground' : positive ? 'text-success' : 'text-destructive',
              )}
            >
              {/*
                The arrow is decorative: direction is already carried by the sign, the
                word in the label, and the colour. Hiding it from the accessibility tree
                stops a screen reader announcing an unnamed graphic mid-sentence.
              */}
              {!flat &&
                (positive ? (
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="size-3" aria-hidden="true" />
                ))}
              <span className="tabular-nums">
                {flat ? '' : positive ? '+' : '−'}
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && (
                <span className="ml-1 font-normal text-muted-foreground">{trendLabel}</span>
              )}
            </span>
          )}
        </div>
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
