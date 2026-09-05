/** Shared formatting helpers used across list, detail, and dashboard views. */

/* ------------------------------------------------------------------ *
 * Currency
 * ------------------------------------------------------------------ */

/**
 * How the merchant has chosen to write money.
 *
 * Held at module scope and set once, rather than passed to each of the ~90 `formatCurrency` calls
 * in this app. Two reasons that is the right shape here and not merely the convenient one:
 *
 *  - `StoreSetting` is a SINGLETON. There is exactly one correct value per deployment at any
 *    instant, so there is no second value this could be confused with. (A multi-tenant admin would
 *    have to revisit this.)
 *  - The admin is a browser SPA, so module scope is per-tab and per-user by construction.
 *
 * The alternative — threading the format through every call site — would mean 90 signature changes
 * and prop-drilling a deployment-constant value through tables, dialogs and chart tooltips, to
 * express something that cannot differ between them.
 */
export interface CurrencyFormat {
  symbol: string
  position: 'BEFORE' | 'AFTER'
  /** Presentation only. Never changes what is stored, computed or charged. */
  decimals: number
}

/**
 * What money looks like before the settings have loaded, and if they never do.
 *
 * Matches the backend's `DEFAULT_PUBLIC_SETTINGS`. Note what this is NOT: the `en-US`/`USD` `Intl`
 * formatter this file used to hardcode, which showed a merchant selling in taka their revenue in
 * dollars on every screen. A default that is occasionally stale beats one that is always wrong.
 */
const FALLBACK_FORMAT: CurrencyFormat = { symbol: '৳', position: 'BEFORE', decimals: 2 }

let currencyFormat: CurrencyFormat = FALLBACK_FORMAT

/**
 * Called once by `CurrencyFormatProvider` when the store settings resolve.
 *
 * Deliberately not exported through a hook: `formatCurrency` is called from render functions, cell
 * renderers and chart formatter callbacks, most of which are not components and cannot hold one.
 */
export function setCurrencyFormat(format: CurrencyFormat) {
  currencyFormat = format
}

export function getCurrencyFormat(): CurrencyFormat {
  return currencyFormat
}

/**
 * Written as an escape, never as a pasted character: a literal U+00A0 is invisible in every editor
 * and indistinguishable from an ordinary space in a diff. The server and storefront copies of this
 * logic spell it the same way.
 */
const NBSP = '\u00A0'

/** One formatter per distinct decimal count — a table of 50 rows should not build 50 of them. */
const currencyFormatterCache = new Map<number, Intl.NumberFormat>()

function digitsFormatter(decimals: number) {
  const cached = currencyFormatterCache.get(decimals)
  if (cached) return cached

  /*
   * `en-US` for grouping, NOT `style: 'currency'`. Currency style derives the symbol and its side
   * from the currency code and locale, which is exactly the decision this feature hands to the
   * merchant — `BDT` in `en-US` renders "BDT 1,200.00", not "৳1,200.00", and offers no way to move
   * the symbol to the trailing position.
   */
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  currencyFormatterCache.set(decimals, formatter)
  return formatter
}

/**
 * Attaches the symbol to an already-formatted number.
 *
 * Spacing is a fixed consequence of the position, not a further setting: none when the symbol leads,
 * one non-breaking space when it trails. That is what leading-symbol and trailing-symbol locales
 * respectively do, and the non-breaking space keeps an amount from wrapping away from its symbol.
 */
function withSymbol(digits: string, format: CurrencyFormat) {
  return format.position === 'AFTER' ? `${digits}${NBSP}${format.symbol}` : `${format.symbol}${digits}`
}

export function formatCurrency(amount: number) {
  return withSymbol(digitsFormatter(currencyFormat.decimals).format(amount), currencyFormat)
}

/**
 * The at-a-glance form — "৳1.2M" on a stat tile.
 *
 * Pinned to one fraction digit regardless of the merchant's `decimals`: this is a magnitude, not an
 * amount, and "৳1.2000M" would be four digits of precision the compact notation has already thrown
 * away. The symbol and its position still follow the setting, so a tile and the exact figure beside
 * it still read as the same currency.
 */
const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompactCurrency(amount: number) {
  return withSymbol(compactCurrencyFormatter.format(amount), currencyFormat)
}

/* ------------------------------------------------------------------ *
 * Everything else
 * ------------------------------------------------------------------ */

const numberFormatter = new Intl.NumberFormat('en-US')

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value)
}

/** `value` is a 0-1 ratio (e.g. a refund rate) — rendered as a percentage with one decimal. */
export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Clock time only — for rows that already show the date on a line of its own. */
export function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatRelativeTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const diffMs = date.getTime() - Date.now()
  const diffSeconds = Math.round(diffMs / 1000)
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'seconds' },
    { amount: 60, unit: 'minutes' },
    { amount: 24, unit: 'hours' },
    { amount: 7, unit: 'days' },
    { amount: 4.34524, unit: 'weeks' },
    { amount: 12, unit: 'months' },
    { amount: Number.POSITIVE_INFINITY, unit: 'years' },
  ]
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

  let duration = diffSeconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return rtf.format(Math.round(duration), 'years')
}

export function formatSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
