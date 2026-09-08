## 1. API layer

- [x] 1.1 In `src/lib/api/store-settings.ts`, add the `CatalogConfig` interface (`showWishlist`, `showCompare`, `showQuickView` — all `boolean`) and `DEFAULT_CATALOG_CONFIG` with all three `true`, mirroring the backend's defaults.
- [x] 1.2 Add `catalogConfig: CatalogConfig` to `StoreSettings` and `catalogConfig?: CatalogConfig` to `StoreSettingsInput`.

  Typed `CatalogConfig | null` on `StoreSettings`, not `CatalogConfig`. The admin read deliberately returns the stored row as-is — the file's own comment on `mainNav` explains why: an editor has to be able to tell "not configured" from "configured to this", or it presents a default as though the merchant had saved it. The page seeds from `DEFAULT_CATALOG_CONFIG` when the column is null, exactly as Checkout Setting does.

## 2. The page

- [x] 2.1 Create `src/features/ui/catalog-settings/catalog-settings-page.tsx`, following `checkout-settings-page.tsx`: `useStoreSettings`, `useSettingsDraft(settings?.catalogConfig, DEFAULT_CATALOG_CONFIG)`, `useUnsavedChangesGuard`, `PageHeader`, `EditorSection` / `EditorRow` / `EditorActions`, `UnsavedChangesDialog`, and `Skeleton` while loading.

  Uses `Card` directly rather than `EditorSection` / `EditorRow`, matching how `checkout-settings-page.tsx` renders its own switch rows. `EditorRow` is built for reorderable list items — it requires `index`, `count`, `onMove` and `onRemove` — and would be the wrong shape for three fixed toggles.

- [x] 2.2 Render three `Switch` rows — Wishlist, Compare, Quick view — each with a label and a line of copy naming what the storefront does when it is off. The quick-view copy must state that a product with variants goes to its full product page instead of opening a preview.

  The copy switches on the current state, so the merchant reads what the site is doing now rather than a static description. Extracted into a local `FeatureSwitch` so the three rows cannot drift apart.

- [x] 2.3 On save, call `useUpdateStoreSettings` with `{ catalogConfig: value }` and nothing else, then `markSaved(value)` and a success toast. On failure, surface the backend's message and leave the draft edits in place.

## 3. Wire it up

- [x] 3.1 Add the lazy import and the `/ui/catalog-settings` route in `src/routes/app-router.tsx`.
- [x] 3.2 Add `{ label: 'Catalog Setting', path: '/ui/catalog-settings', icon: <pick one consistent with the group> }` to the UI group in `src/routes/nav-config.ts`, directly above Checkout Setting.

  Icon is `Boxes` — already imported and unused elsewhere in the UI group. `SlidersHorizontal` was the other candidate but is already Catalog → Attributes.

## 4. Minimal verification

Happy path only — no test suite for this page. Check it by hand.

**Needs a signed-in admin session, which this environment cannot produce.** What could be checked without one was: the page module compiles through the running Vite dev server (200, 21 KB, containing the expected strings), so its imports resolve and its JSX transforms; `npx tsc --noEmit` is clean; `npx eslint` on all four touched files exits 0; and the existing suite is 155/155.

- [ ] 4.1 Open the page: the three switches load in their saved positions, not the defaults, once the record has arrived.
- [ ] 4.2 Turn Compare off and save: a success toast appears, and reloading the page shows Compare still off with the other two unchanged.
- [ ] 4.3 Confirm the save did not disturb other settings — open Checkout Setting and Site Setting and check their values are as before.

  Disjointness holds structurally: the save sends `{ catalogConfig }` and nothing else, and `PATCH /settings` is a partial upsert. Independently confirmed on the server side — a write of `catalogConfig` alone left `checkoutConfig` and `theme` untouched.

- [ ] 4.4 Toggle a switch and navigate away without saving: the unsaved-changes guard prompts.
- [x] 4.5 Run the project's lint and type check.

  `npx tsc --noEmit` clean. `npm run lint` reports one error and five warnings across the project, all pre-existing and in files this change does not touch — the error is `react-hooks/refs` in `src/lib/realtime/use-order-alert.ts:64`. Linting only this change's four files exits 0.
