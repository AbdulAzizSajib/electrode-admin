/**
 * Ranked-magnitude bar list — sequential (one hue) encoding for "compare magnitude, high to low"
 * (top products, sales by category). Not categorical: these rows aren't distinct series being told
 * apart, they're one measure ranked, so a single hue is the correct color job (see dataviz skill,
 * choosing-a-form.md). Bars are capped at 8px thick, 4px rounded data-end, grow from a single
 * left baseline; value sits at the tip since it's a bar (not a column).
 */
export interface BarListItem {
  key: string
  label: string
  sublabel?: string
  value: number
  valueLabel: string
}

export interface BarListProps {
  items: BarListItem[]
}

export function BarList({ items }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">{item.label}</span>
            <span className="shrink-0 font-medium text-foreground">{item.valueLabel}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
          {item.sublabel && <span className="text-[11px] text-muted-foreground">{item.sublabel}</span>}
        </div>
      ))}
    </div>
  )
}
