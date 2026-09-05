import { useStoreSettings } from '@/lib/api/store-settings'
import { getCurrencyFormat, setCurrencyFormat, type CurrencyFormat } from '@/lib/utils/format'

/**
 * Feeds the merchant's currency settings into `format.ts` and reports a key that changes when they
 * arrive.
 *
 * A hook rather than a wrapper component, because of what has to happen when the settings resolve.
 * `formatCurrency` reads module state, and module state is not reactive — anything already rendered
 * with the fallback would keep showing it. Nor can the format be delivered through React context:
 * `formatCurrency` is called from table cell renderers, chart tooltip callbacks and column
 * definitions, most of which are not components and cannot consume one. That is the whole reason
 * the format lives at module scope; see the note on `setCurrencyFormat`.
 *
 * So the caller puts the returned key on the subtree that renders money. The format changes at most
 * once per session — from the fallback to the merchant's, the moment `/settings` answers — so this
 * is a single early remount, before the user has typed anything, and never again.
 *
 * Until then `formatCurrency` uses its documented fallback, so the first paint shows `৳1,200.00`
 * rather than a bare number. A store whose settings match the fallback never visibly changes at all,
 * and the key never moves.
 */
export function useCurrencyFormatSync(): string {
  const { data } = useStoreSettings()

  if (data) {
    const next: CurrencyFormat = {
      symbol: data.currencySymbol,
      position: data.currencyPosition,
      decimals: data.currencyDecimals,
    }

    // Guarded so the write is idempotent: applying an identical format on every render would be
    // harmless but pointless, and StrictMode's double render would do it twice.
    const current = getCurrencyFormat()
    if (
      current.symbol !== next.symbol ||
      current.position !== next.position ||
      current.decimals !== next.decimals
    ) {
      setCurrencyFormat(next)
    }
  }

  const { symbol, position, decimals } = getCurrencyFormat()
  return `${symbol}|${position}|${decimals}`
}
