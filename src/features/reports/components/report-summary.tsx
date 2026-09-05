import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'

/**
 * The tiles above every report.
 *
 * Every value shown here is computed by the server over the WHOLE filtered
 * result, never the visible page — `admin-reporting/report-shell` requires
 * that changing the page or page size never changes a total, and the only way
 * to guarantee that is to never derive these from `rows`.
 */
export interface ReportStat {
  label: string
  value: string
  /** Secondary line — used for disclosures like "excludes 4 items with no cost price". */
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}

const TONE_CLASS: Record<NonNullable<ReportStat['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-destructive',
  muted: 'text-muted-foreground',
}

export function ReportSummary({
  stats,
  isLoading,
}: {
  stats: ReportStat[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-32" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stat.label}
          </p>
          <p className={cn('mt-1 text-xl font-semibold', TONE_CLASS[stat.tone ?? 'default'])}>
            {stat.value}
          </p>
          {stat.hint && <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>}
        </Card>
      ))}
    </div>
  )
}
