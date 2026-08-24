import { Badge, type BadgeProps } from '@/components/ui/badge'

/**
 * Categorical breakdown by a fixed enum (order status, payment method, return/refund status).
 * Identity here already has a codebase-wide convention — every status column elsewhere renders a
 * `Badge` with a semantic variant (success/warning/info/destructive/secondary), never a generated
 * hue — so this reuses that instead of introducing a new categorical ramp. The badge is the
 * identity channel (never color-alone: it always carries a text label); the bar is a plain neutral
 * fill for at-a-glance magnitude, not a second color-identity channel.
 */
export interface StatusBarListItem {
  key: string
  label: string
  variant: BadgeProps['variant']
  count: number
  amountLabel?: string
}

export interface StatusBarListProps {
  items: StatusBarListItem[]
}

export function StatusBarList({ items }: StatusBarListProps) {
  const max = Math.max(...items.map((i) => i.count), 1)
  const total = items.reduce((sum, i) => sum + i.count, 0)

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <Badge variant={item.variant} className="w-28 shrink-0 justify-center">
            {item.label}
          </Badge>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: item.count === 0 ? 0 : `${Math.max((item.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-foreground">{item.count}</span>
          {item.amountLabel && (
            <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{item.amountLabel}</span>
          )}
        </div>
      ))}
      {total === 0 && <p className="text-xs text-muted-foreground">No activity in this range.</p>}
    </div>
  )
}
