import { useStoreSettings } from '@/lib/api/store-settings'

/**
 * The panel's own brand lockup, in the sidebar head and its mobile twin.
 *
 * Reads the merchant's store name rather than saying "Ecom Admin", which was
 * hardcoded in both places: a shop called Gadgets Mart was administered from a
 * panel bearing a product name its staff had never chosen and could not change,
 * while the name they DID set sat one click away under UI → Site Setting.
 *
 * `useStoreSettings` is already resolved by the time this paints —
 * `ShellLayout` reads the same `/settings` query through
 * `useCurrencyFormatSync` — so this is a cache hit, not a second request.
 *
 * The split follows the storefront's `brandName`: the accent half is a separate
 * column so a merchant can colour the second word, e.g. Gadgets|Mart. The
 * storefront paints it with its own `--color-accent`; the panel has no such
 * token, so it uses the primary blue, which is the panel's one brand colour and
 * carries on the dark sidebar. Falling back to the product name only when the
 * store has none keeps a fresh install from rendering a headless sidebar.
 *
 * Wordmark only — no monogram tile. The square held a hardcoded "E" that no
 * longer matched anything once the name became the merchant's, and deriving its
 * letter from the store name only restated the word sitting beside it.
 */
export function ShellBrand({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useStoreSettings()

  const storeName = data?.storeName?.trim() || 'Ecom Admin'
  const accent = data?.siteNameAccent?.trim() ?? ''

  // Collapsed, the rail is 4rem and the full name cannot fit, so it falls back
  // to the initial — the name shortened, not a mark standing in for it.
  if (collapsed) {
    return (
      <span className="w-full text-center text-sm font-semibold text-white">
        {storeName.charAt(0).toUpperCase()}
      </span>
    )
  }

  // `truncate` with `min-w-0`: the sidebar is a fixed 19rem and a store name is
  // free text, so a long one has to end in an ellipsis rather than push the
  // lockup out of its own box.
  return (
    <span className="min-w-0 truncate text-xl font-semibold text-white">
      {storeName}
      {accent && <span className="ml-1 text-primary">{accent}</span>}
    </span>
  )
}
