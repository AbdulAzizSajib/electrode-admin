import * as React from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_VALUE } from '@/features/reports/report-utils'

/**
 * The filter bar every report shares.
 *
 * Two behaviours `admin-reporting/report-shell` requires and that are easy to
 * lose if each page builds its own: the applied filters are STATED on screen,
 * and one action clears all of them back to the report's defaults (including
 * the date range).
 */

export interface ReportFilterOption {
  value: string
  label: string
}

/**
 * A single-select filter. `ALL_VALUE` (from `report-utils.ts`) is the unset
 * state rather than an empty string — see the note on that constant.
 */
export function ReportFilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  className = 'w-44',
}: {
  label: string
  value: string
  options: ReportFilterOption[]
  onChange: (value: string) => void
  allLabel?: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export interface AppliedFilter {
  label: string
  onClear: () => void
}

export function ReportToolbar({
  children,
  applied,
  onClearAll,
  actions,
}: {
  /** The filter controls themselves. */
  children: React.ReactNode
  /** What is currently narrowing the report, so it is never a mystery why a number is small. */
  applied: AppliedFilter[]
  onClearAll: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">{children}</div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {applied.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          {applied.map((filter) => (
            <Badge key={filter.label} variant="secondary" className="gap-1">
              {filter.label}
              <button
                type="button"
                onClick={filter.onClear}
                aria-label={`Remove filter ${filter.label}`}
                className="ml-0.5 rounded-sm hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button size="lg" variant="ghost" onClick={onClearAll} className="h-6 px-2 text-xs">
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
