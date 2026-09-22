## 1. Types and registry mirror

- [x] 1.1 In `src/lib/api/store-settings.ts`, add `HeroVariant = 'SPLIT_THREE' | 'SPLIT_ONE' | 'FULL_SLIDER' | 'SLIDER_STACK'` mirroring the server's `HERO_VARIANTS` tuple, in the same order — position 0 is the default.
- [x] 1.2 Add `HERO_VARIANT_OPTIONS`: per variant, a merchant-facing `label` and a one-line `description` of the arrangement. No internal names reach the screen.
- [x] 1.3 Add optional `variant?: HeroVariant` to the `HomeConfig` entry type.
- [x] 1.4 Leave `DEFAULT_HOME_CONFIG` variant-free, matching the server (design.md Decision 6). Comment why.
- [x] 1.5 Rewrite `HOME_SECTION_REGISTRY`'s `HERO` description — it currently reads "with the slider and its side tiles", which describes one arrangement as though it were the only one.

## 2. Per-layout geometry

- [x] 2.1 In `src/features/ui/home-slider/hero-slots.ts`, add `HERO_GEOMETRY: Record<HeroVariant, …>` holding each arrangement's column fraction, tile count, tile ratios and slider ratio, using the figures in design.md Decision 7. Keep `SPLIT_THREE`'s numbers **exactly** as `SIDE_COLUMN_FRACTION` and `PROMO_RATIO` hold them today.
- [x] 2.2 Change `renderedSize` to `renderedSize(variant, placement, contentWidth)`, moving the current arithmetic under the `SPLIT_THREE` case and adding the other three. Everything stays a fraction or a ratio; `HERO_GAP`, `CONTENT_PADDING`, `WIDEST_CONTENT_WIDTH` and `FULL_WIDTH_REFERENCE` are unchanged.
- [x] 2.3 Replace the `HERO_SLOTS` constant with `heroSlots(variant): readonly HeroSlot[]`, returning only the slots that arrangement renders, with per-arrangement `capacity`, `label` and `description`. `recommended` keeps deriving from `widest`/`forUpload`, so it follows automatically.
- [x] 2.4 Update `getHeroSlot` to take the variant. Leave `isHeroPlacement`, `HERO_PLACEMENTS`, `formatSize`, `formatRatio`, `RATIO_TOLERANCE`, `MOBILE_ARTWORK` and `checkDimensions` alone — `checkDimensions` reads `slot.recommended` and needs no change.
- [x] 2.5 Add `unusedSlots(variant)` returning the hero placements that arrangement does not render, for the group in section 4.
- [x] 2.6 Rewrite the module's header comment: it currently explains the one layout's pixels-to-ratios history. Keep that history and add that the geometry is now per arrangement and must match `frontend/src/components/home/hero/`.
- [x] 2.7 Add `hero-slots.test.ts`: `SPLIT_THREE`'s `renderedSize` and `recommended` match the values the module produces today at widths 1140/1440/1600/full (a regression guard on the refactor); each arrangement's slot list has the right placements and capacities; `unusedSlots` is the complement.

## 3. The layout picker

- [x] 3.1 Add `variant-picker.tsx` under `src/features/ui/home-slider/`: a radio group of four cards, each with an inline SVG diagram of the arrangement at its real ratios, plus label and description. **Not a Radix `Select`** — design.md, Risks.
- [x] 3.2 Mount it on `home-slider-page.tsx` above the slot grid, selected from the settings payload. Do not default it in the panel; the server always resolves it (design.md Decision 6).
- [x] 3.3 Keyboard and screen-reader support: a labelled radio group, arrow-key navigation between options, a visible focus ring on the card. If a focusable `sr-only` element is used, give its parent `relative` — otherwise focusing it scrolls the fixed admin shell off screen.
- [x] 3.4 Saving: refetch `useStoreSettings` first, build `homeConfig` from **that** response, change only the `HERO` entry's `variant`, and `PATCH` the whole array (design.md Decision 2). Send `homeConfig` only — no other editor's fields.
- [x] 3.5 Success and failure toasts matching the page's existing ones; a refused save leaves the previous selection shown, with the backend's own message above the picker.

## 4. Layout-aware slot management

- [x] 4.1 Drive the slot grid from `heroSlots(variant)` so it is laid out as the chosen arrangement lays it out — one wide box for `FULL_SLIDER`, a wide box above a row of three for `SLIDER_STACK`.
- [x] 4.2 Pass the current arrangement's slot into `slot-editor-dialog.tsx` so the size guidance beside the upload control is that arrangement's. Confirm `checkDimensions` now warns against the right shape.
- [x] 4.3 Add the **"Not used by this layout"** group below the grid, listing any slot from `unusedSlots(variant)` that still holds banners, fully editable, headed so that "kept — used again if you switch back" is the first thing read (design.md Decision 4). Omit the group entirely when it is empty.
- [x] 4.4 Recount the existing capacity-overflow message against the current arrangement's capacity. The wording already exists; only the number changes.
- [x] 4.5 Update `PAGE_DESCRIPTION` — "laid out as the storefront renders it" is still true, and now true of four arrangements, so say which one is in view.

## 5. Home Sections cross-reference

- [x] 5.1 On `home-sections-page.tsx`, add a read-only line to the `HERO` row naming the current arrangement, linking to Home Slider. No control — one place makes the choice (spec: the section list points at where the arrangement is set).
- [x] 5.2 Fix the normalisation around line 380: it rebuilds entries as `{ key, enabled }` and would **drop a stored `variant` on every save from this page**. Carry the field through. This is the same silent-drop hazard the server change calls out in its reconciler, and it is the most likely defect in this change.
- [x] 5.3 Add a test asserting that saving from Home Sections preserves an existing `HERO` variant.

## 6. Verification

- [x] 6.1 `cd admin && npx vitest run src/features/ui/home-slider/hero-slots.test.ts` (flags do not survive `npm --prefix`), on an uppercase `E:\` path.
- [x] 6.2 `npm run lint` and `npx tsc --noEmit` clean. Confirm no call site of `renderedSize` or `heroSlots` was left without a variant — the signature change exists to force that.
- [x] 6.3 Confirm nothing imports `antd`.
- [ ] 6.4 End to end against a running server and storefront. **Data path verified:** each arrangement saves through `PATCH /settings`, and the storefront then renders exactly the structure that arrangement's diagram shows — the 43% column for the two split layouts, `lg:aspect-3/1` for the two wide ones, `lg:grid-cols-3` only for SLIDER_STACK, and no pixel-sized box in any of them. **Clicking the picker in a browser still needs a human; there is no browser automation in this repo.**
- [x] 6.5 Ratio warning across layouts. `hero-slots.test.ts` asserts it directly: artwork cut for SPLIT_THREE's promo tile, checked against FULL_SLIDER's slider, returns a `ratio` warning whose message says the image will be cropped and names the recommended size — while artwork cut for the layout in use returns null. It stays advisory: a return value, not a guard.
- [ ] 6.6 The "Not used by this layout" group on screen. **Verified below the UI:** `unusedSlots(variant)` is exactly the complement of `heroSlots(variant)` for all four arrangements, the page groups banners by every hero placement rather than only the rendered ones, and cycling every layout through the API leaves every banner byte-identical. **Seeing the group render, and its rows still being editable, needs a human with a browser.**
- [x] 6.7 The HERO variant survives a save from Home Sections. `hero-variant-preserved.test.tsx` drives the real page: toggling an unrelated section, and toggling the hero itself, both send the variant back unchanged, and a store that never chose one still sends none.
- [x] 6.8 Content width. `hero-slots.test.ts` asserts both halves for all four arrangements: `recommended` is identical at 1140/1440/1600/full, and `renderedSize` grows in both dimensions from 1140 to 1600. Every slot also keeps its ratio across all four widths.

## 7. Close out

- [x] 7.1 Geometries compared against `frontend/src/components/home/hero/` by script, slot by slot: the 43% column, the square side tiles, the 43:20 promo, the 3:1 slider, the 4:3 stacked tiles, the three-across row, and the shared gap and container padding all agree — and each file still names the other as the thing to keep in step.
- [ ] 7.2 Confirm the server and storefront changes are both DEPLOYED before this one ships. Both are implemented in this working tree and verified against a locally running stack, but nothing has been committed or deployed — that is the remaining gate (design.md — Migration Plan).
