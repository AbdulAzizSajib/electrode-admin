/**
 * Non-component helpers shared by the report pages.
 *
 * Kept out of the component files on purpose: a module that exports both a
 * component and a plain function breaks React Fast Refresh, which the
 * `react-refresh/only-export-components` lint rule enforces across this app.
 */

export interface DateRangeValue {
  from: string
  to: string
}

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` for a Date, in the browser's own zone — only ever used to seed the date inputs. */
export function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function daysAgo(days: number): string {
  return toDateInput(new Date(Date.now() - days * DAY_MS))
}

/** The last 30 days ending today — the default `admin-reporting/report-shell` requires, mirroring the server's own fallback. */
export function defaultDateRange(): DateRangeValue {
  return { from: daysAgo(29), to: toDateInput(new Date()) }
}

/** The common questions, one click each rather than two calendar interactions. */
export function rangePresets(): Array<{ label: string; value: DateRangeValue }> {
  const today = new Date()
  const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)

  return [
    { label: 'Today', value: { from: toDateInput(today), to: toDateInput(today) } },
    { label: '7 days', value: { from: daysAgo(6), to: toDateInput(today) } },
    { label: '30 days', value: { from: daysAgo(29), to: toDateInput(today) } },
    { label: 'This month', value: { from: toDateInput(startOfThisMonth), to: toDateInput(today) } },
    {
      label: 'Last month',
      value: { from: toDateInput(startOfLastMonth), to: toDateInput(endOfLastMonth) },
    },
  ]
}

/**
 * The unset state for a single-select filter.
 *
 * Not an empty string: Radix's Select treats "" as no value and would render a
 * blank trigger, and an empty `supplierId=` on the wire is a filter matching
 * nothing rather than the absence of one — the same trap `list-query.ts`
 * documents for `searchTerm`.
 */
export const ALL_VALUE = 'all'

/** The note under a report's date picker, stating what the server actually resolved. */
export function resolvedRangeNote(range: { from: string; to: string; timeZone: string } | null) {
  if (!range) return undefined
  return `Covering ${range.from} to ${range.to} inclusive (${range.timeZone})`
}
