import * as React from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeriesPoint } from '@/lib/api/dashboard'
import { formatDate } from '@/lib/utils/format'

/**
 * The dashboard's two time-series charts (revenue, orders).
 *
 * One component rather than two inline copies: they were duplicated with the chrome
 * drifting between them — the orders chart shipped a `Tooltip` with no `formatter`, so
 * it rendered Recharts' raw datum key and the merchant read a hover of "value : 42".
 * Everything that differs between the two is a prop; everything else is shared by
 * construction, so a fix to one is a fix to both.
 *
 * Chrome follows the dataviz mark specs: a solid hairline grid (never dashed — dashing
 * reads as "projection" or "threshold" when it is only a grid), a 2px line, and the
 * series hue at ~12% as an area wash rather than a saturated block.
 */
export interface TrendChartProps {
  data: TimeSeriesPoint[]
  /** Names the measure — shown as the chart's own label and in the tooltip. */
  label: string
  /** Series hue. A CSS custom property reference, e.g. `var(--color-primary)`. */
  color: string
  /** Formats the y-axis ticks (compact) — kept separate from `formatValue`, which is exact. */
  formatTick: (value: number) => string
  /** Formats the tooltip value — the exact figure, never the compacted one. */
  formatValue: (value: number) => string
  /** Y-axis gutter. Currency needs more room than a plain count. */
  axisWidth?: number
  allowDecimals?: boolean
}

/** Date only — the x-axis has no room for the year on a 90-day range. */
function formatAxisDate(value: string) {
  return formatDate(value).replace(/,.*/, '')
}

export function TrendChart({
  data,
  label,
  color,
  formatTick,
  formatValue,
  axisWidth = 48,
  allowDecimals = true,
}: TrendChartProps) {
  /* SVG gradient ids are document-global — two charts on one page sharing a literal id
     would make the second silently paint with the first's fill. */
  const gradientId = React.useId()

  return (
    <figure className="m-0 flex flex-col">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">{label}</figcaption>
      {/*
        `height` covers the plot AND the x-axis band. Recharts lays the axis out inside
        the container, so a height chosen for the plot alone pushes the date labels
        against the card's padding.
      */}
      <ResponsiveContainer width="100%" height={232}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          {/*
            The zero tick is suppressed: the baseline is already the visual zero, so
            printing "0" (or "৳0") there is a label for something the axis states by
            position. Every other tick keeps its unit.
          */}
          <YAxis
            tickFormatter={(value: number) => (value === 0 ? '' : formatTick(value))}
            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={axisWidth}
            allowDecimals={allowDecimals}
          />
          <Tooltip
            formatter={(value) => [formatValue(Number(value)), label]}
            labelFormatter={(v) => formatDate(v as string)}
            cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-foreground)',
              boxShadow: '0 2px 8px -2px rgb(16 24 40 / 0.12)',
            }}
            labelStyle={{ color: 'var(--color-muted-foreground)', marginBottom: 2 }}
          />
          {/*
            A vertical wash, not a flat tint. An area that runs from the series' peak all
            the way down to the baseline covers most of the plot, so even a low flat
            opacity lays down a large slab of colour that competes with the line carrying
            the actual values. Fading the fill out towards the baseline keeps the ink
            where the data is — dense under the curve, gone by the axis.
          */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            /* The surface ring keeps the hover dot legible where it sits on the line. */
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}
