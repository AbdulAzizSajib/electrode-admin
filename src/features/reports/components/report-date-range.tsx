import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rangePresets, type DateRangeValue } from '@/features/reports/report-utils'

/**
 * The date range control every period-based report shares.
 *
 * Built from two native `<input type="date">` plus preset buttons rather than
 * antd's `RangePicker`. The design called for the antd control on the grounds
 * that `dayjs` ships with antd and so costs nothing — under pnpm's strict
 * node_modules layout it does not: `dayjs` is antd's own dependency and is not
 * hoisted, so importing it would mean adding a direct dependency the proposal
 * rules out.
 *
 * Native date inputs turn out to be the better fit anyway: they produce and
 * consume `YYYY-MM-DD` strings directly, which is exactly the wire format the
 * API takes, so there is no date library and no conversion layer at all. The
 * server owns the timezone these dates are resolved in.
 */
export interface ReportDateRangeProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  /** Rendered underneath — the range the SERVER resolved, so an off-by-one is visible rather than arguable. */
  resolvedNote?: string
}

export function ReportDateRange({ value, onChange, resolvedNote }: ReportDateRangeProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          aria-label="Start date"
          className="h-8 w-[9.5rem]"
          value={value.from}
          // `min`/`max` keep the two inputs from crossing, so the server's
          // rejection of a backwards range is a backstop rather than the
          // merchant's first hint.
          max={value.to}
          onChange={(event) => event.target.value && onChange({ ...value, from: event.target.value })}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          aria-label="End date"
          className="h-8 w-[9.5rem]"
          value={value.to}
          min={value.from}
          onChange={(event) => event.target.value && onChange({ ...value, to: event.target.value })}
        />

        {rangePresets().map((preset) => {
          const isActive = preset.value.from === value.from && preset.value.to === value.to
          return (
            <Button
              key={preset.label}
              size="lg"
              variant={isActive ? 'default' : 'outline'}
              className="h-8"
              onClick={() => onChange(preset.value)}
            >
              {preset.label}
            </Button>
          )
        })}
      </div>
      {resolvedNote && <span className="text-xs text-muted-foreground">{resolvedNote}</span>}
    </div>
  )
}
