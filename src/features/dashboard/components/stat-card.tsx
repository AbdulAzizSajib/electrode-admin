import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

export interface StatCardProps {
  label: string
  value: string
  trend: number
  icon: LucideIcon
}

export function StatCard({ label, value, trend, icon: Icon }: StatCardProps) {
  const positive = trend >= 0
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-semibold text-foreground">{value}</span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              positive ? 'text-success' : 'text-destructive',
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
