## Why

The Home Slider page exists to show a merchant *which box they are editing*. Its own comment says so: every slot is drawn at its true aspect ratio, "measured off the storefront's own `Hero.tsx`", so an empty promo tile looks like the wide strip it will become rather than like another row in a table. `hero-slots.ts` carries that promise further — one constant driving the size guidance beside each upload control, the shape of the empty placeholder, the threshold the dimension warning checks against, and the "renders at" figure for the merchant's own content width.

All of it is arithmetic for exactly one layout. `SIDE_COLUMN_FRACTION = 0.43`, `PROMO_RATIO = 43/20`, two square side tiles, one promo.

`add-hero-section-variants` (in `server/`) has made the hero's arrangement a stored setting, and `add-hero-section-variants-ui` (in `frontend/`) renders four of them. Until this change lands, the admin panel has two problems and the second is worse than the first: a merchant has **no way to choose** a layout, and the moment one is chosen by any other means the Home Slider page starts **lying** — drawing `SPLIT_THREE`'s boxes, quoting `SPLIT_THREE`'s upload sizes, and warning about `SPLIT_THREE`'s aspect ratios for a store rendering something else. A merchant would export a 1720×1290 file because this page told them to, and watch the storefront crop it to a band.

## What Changes

- **A layout picker on the Home Slider page**, above the slots. Four options, each with a small diagram of the arrangement rather than a name alone — `SPLIT_THREE` and `SLIDER_STACK` use the same three slots and differ only in where they sit, which no wording makes obvious.
- The picker lives **here, not on Home Sections**, because this is the only page that shows what a layout looks like and the only page whose guidance depends on the answer.
- **`hero-slots.ts` becomes a function of the layout.** `HERO_SLOTS` → `heroSlots(variant)`, and `renderedSize(placement, contentWidth)` → `renderedSize(variant, placement, contentWidth)`, with the geometry of all four layouts expressed the same way the current one is — fractions and ratios, no pixels. Everything downstream (`recommended`, `checkDimensions`, `formatSize`, the placeholder shape) follows from that without further change, which is the point of it having been one constant.
- **The slot preview reflects the chosen layout.** A store on `FULL_SLIDER` sees one wide box; a store on `SLIDER_STACK` sees a wide box above a row of three. The page keeps its promise or it should not make it.
- **Capacity is per layout**, because it is: `SPLIT_ONE` renders one side tile where `SPLIT_THREE` renders two. The existing overflow message — which exists precisely so a banner past the limit is visible rather than silently unrendered — now counts against the current layout's capacity.
- **Slots the chosen layout does not render are shown, not hidden**, in a separate "Not used by this layout" group, with the banners still listed and still editable. **This is the most important thing in this change.** The artwork is on file and the storefront will render it again the moment the merchant switches back; a page that simply stopped showing it would teach the merchant that changing layout destroys their uploads, and the first thing they would do is re-upload everything.
- The Home Sections page gains a **read-only line** on its `HERO` row naming the current layout and linking to Home Slider. That page owns `homeConfig` today, so a merchant who goes looking for the setting there finds a pointer instead of nothing.
- `HOME_SECTION_REGISTRY`'s `HERO` description — "The big banner area at the very top, with the slider and its side tiles" — is rewritten, since it describes one layout as though it were the only one.
- `HomeConfig` in `src/lib/api/store-settings.ts` gains optional `variant` and a `HeroVariant` union mirroring the server's registry, and the editor's normalisation carries it through instead of rebuilding entries as `{ key, enabled }`.
- **BREAKING for a merchant in one way:** the upload sizes this panel recommends now depend on the chosen layout. A merchant who changes layout will be told to upload differently shaped artwork, and their existing files may draw a ratio warning. That is the warning doing its job — the artwork really will be cropped — and it stays advisory, never blocking, exactly as it is today.

Stated because its absence is deliberate: **no preview of the merchant's own artwork inside the picker.** The diagrams are line drawings of the arrangement, not thumbnails of their banners. Rendering four live previews would need every hero image at four sets of dimensions on a settings page, and the slot grid directly beneath the picker already shows the real artwork in the real shapes.

Also deliberate: **switching layout uploads nothing, deletes nothing and moves nothing.** It writes one string.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-settings`: extends the homepage-hero management requirement so an OWNER/ADMIN can choose the hero's arrangement from the set the server offers; so the artwork guidance, slot shapes and capacities this panel presents are those of the chosen arrangement rather than a fixed one; and so artwork belonging to a slot the chosen arrangement does not render remains visible and editable, identified as unused rather than removed from the screen.

## Impact

- `src/features/ui/home-slider/hero-slots.ts` — the geometry becomes per layout; `HERO_SLOTS` and `renderedSize` change signature. `isHeroPlacement`, `formatSize`, `formatRatio`, `RATIO_TOLERANCE` and `MOBILE_ARTWORK` are unchanged.
- `src/features/ui/home-slider/home-slider-page.tsx` — the picker, the layout-aware slot grid, the unused-slot group, and the save that writes the variant.
- `src/features/ui/home-slider/slot-editor-dialog.tsx` — receives the slot for the current layout; the size guidance beside the upload control follows from that.
- `src/features/ui/home-sections/home-sections-page.tsx` — the read-only line on the `HERO` row; normalisation preserves `variant`.
- `src/lib/api/store-settings.ts` — `HeroVariant`, `HERO_VARIANT_OPTIONS`, optional `variant` on the `HomeConfig` entry, `HOME_SECTION_REGISTRY`'s `HERO` description.
- Tests: `admin` runs Vitest in `jsdom`. The geometry is pure and gets a unit test; the picker gets a component test alongside the existing ones.
- **Depends on** both `server/openspec/changes/add-hero-section-variants` and `frontend/openspec/changes/add-hero-section-variants-ui`. **Ships last** — a picker that saves a layout the storefront cannot yet render would let a merchant choose something and see nothing change.
