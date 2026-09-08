## Why

The backend is gaining a `catalogConfig` block on the store settings record — three flags governing whether the storefront offers a wishlist, product comparison, and quick view (see the `server` change `add-catalog-display-settings`). Without an editor here, the only way to set them is a direct API call, which puts a merchant-facing decision behind a developer.

These are decisions a merchant makes about their own shop — a wholesale catalogue has no use for a wishlist, a single-product store has nothing to compare — so they belong beside Checkout Setting and Site Setting in the UI section, not in a support ticket.

## What Changes

- A new **Catalog Setting** page at `/ui/catalog-settings`, listed in the UI section of the sidebar alongside Checkout Setting and Site Setting.
- Three switches — Wishlist, Compare, Quick view — each with a line of copy stating what the storefront does when it is off, so the merchant is not guessing. In particular, the quick-view copy states that with it off, a product with variants sends the shopper to its full product page instead of opening a preview.
- The page reads and writes **only** `catalogConfig`, joining the disjoint-field-set arrangement Checkout Setting, Header Links, and Footer Links already use, so saving here cannot clobber another editor's settings.
- Standard editor behaviour for this section: skeleton while loading, dirty tracking, an unsaved-changes guard on navigation, and a toast on save.
- `src/lib/api/store-settings.ts` gains the `CatalogConfig` type, a `DEFAULT_CATALOG_CONFIG` constant mirroring the backend's, and the field on `StoreSettings` / `StoreSettingsInput`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-settings`: adds a requirement that the catalog display features are editable from the admin panel, independently of one another and without disturbing settings the page does not present.

## Impact

- `src/features/ui/catalog-settings/catalog-settings-page.tsx` — new page.
- `src/routes/app-router.tsx` — lazy import and a `/ui/catalog-settings` route.
- `src/routes/nav-config.ts` — one entry in the UI group.
- `src/lib/api/store-settings.ts` — the type, the default, and the two interface fields.
- Depends on the `server` change `add-catalog-display-settings` being deployed first; until then `PATCH /settings` rejects the field.
- No effect on any other admin screen — this page writes one field that nothing else writes.
