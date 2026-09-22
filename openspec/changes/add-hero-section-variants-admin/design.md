## Context

See proposal.md — Why. Three existing arrangements in this panel shape the approach.

**`hero-slots.ts` is deliberately one constant driving four things** — the size guidance beside each upload control, the empty placeholder's aspect ratio, the threshold `checkDimensions` compares against, and the "renders at" figure. Its comment records exactly why: those four had drifted apart when each carried its own number. That structure is what makes this change tractable — parameterise the geometry and all four follow.

**Settings editors write disjoint field sets.** `PATCH /settings` is a partial upsert, and Home Sections writes `homeConfig` and `newsletter` and nothing else, which is what keeps eight editors from clobbering each other. The hero's arrangement lives *inside* `homeConfig`, so putting the picker on the Home Slider page means a second editor writing that column — see Decision 2.

**Two screens already split the hero.** Home Sections (`home-sections-page.tsx`) owns whether the hero is shown and where; Home Slider (`home-slider-page.tsx`) owns what is in it. The arrangement is a third thing that sits between them.

Also in force: `antd` is not a dependency and nothing may import it; there is one form stack (react-hook-form + zod over the shared scaffolds); and on an edit page the form mounts only after the record has loaded, because a Radix `Select` mounted first silently clears a react-hook-form `values` reset.

## Goals / Non-Goals

**Goals:**

- A merchant can see what each arrangement looks like before choosing it.
- Everything this panel tells a merchant about artwork is true for the arrangement their store actually uses.
- Changing arrangement cannot cost a merchant their uploads, and cannot *look* like it did.

**Non-Goals:**

- Rendering the storefront's real hero here. The slot grid is a schematic at true ratios; it always was.
- Per-arrangement artwork slots. One set of banners serves all four — see the server change's design, Decision 6.
- A preview of the merchant's own images inside the picker. See proposal.md.
- Choosing arrangements for sections other than the hero. Product cards and the category grid are later slices.

## Decisions

### 1. `heroSlots(variant)` and `renderedSize(variant, …)`, not a fifth constant

**Chosen:** the existing module keeps its shape and gains a layout parameter. `HERO_GEOMETRY: Record<HeroVariant, …>` holds each arrangement's column fractions and tile ratios; `heroSlots(variant)` builds the slot list from it; `renderedSize` takes the variant first.

The alternative — leaving `HERO_SLOTS` as the default and adding `SLIDER_STACK_SLOTS` beside it — reintroduces exactly the drift the module's comment says it exists to prevent, four times over. A parameter keeps one derivation, and `recommended`, `checkDimensions` and the placeholder ratios continue to fall out of it without being touched.

Changing the exported signatures rather than adding overloads is deliberate: every call site has to be visited, and a call site that still passes no variant should fail to compile rather than silently quote the default arrangement's numbers.

### 2. The picker lives on Home Slider, and that page writes `homeConfig`

**Chosen:** the picker is on Home Slider. Home Sections shows the current arrangement read-only and links across.

Home Sections is where `homeConfig` is edited and would be the tidy place to put it. But a merchant choosing between four arrangements needs to see them, and needs the upload guidance beneath to move when they do — both of which only exist on Home Slider. Putting the control away from its consequences is how a merchant picks a layout and never notices that the recommended sizes changed.

**The cost is real and has to be named:** two editors now write `homeConfig`, and a save replaces the whole array. If a merchant has Home Sections open in another tab with a stale list, the later save wins wholesale and the earlier one's reordering is lost. Mitigations, in order of importance: Home Slider refetches settings immediately before saving and builds its payload from that response rather than from cached state, so the window is a round trip rather than a session; it sends the list otherwise byte-identical, changing one field of one entry; and the server reconciles what it receives, so neither page can corrupt the list's shape — only its order. Accepted rather than solved, because the alternative is a picker a merchant cannot evaluate.

Rejected: a dedicated `heroVariant` column that avoids the collision entirely. That was considered and rejected in the server change (design.md Decision 1) for reasons that outlive this one.

### 3. Diagrams, not labels, and not thumbnails

`SPLIT_THREE` and `SLIDER_STACK` use the same three slots — a slider, two side tiles, a promo — and differ only in arrangement. "Split three" and "Slider stack" are meaningless to a merchant; so is any sentence short enough to fit in a radio label.

So each option renders a small inline SVG of the arrangement: plain boxes at the real ratios, current selection in the brand colour. It costs nothing to load, scales, and is the same drawing the slot grid below makes at full size. Live thumbnails of the merchant's artwork were rejected in the proposal; static screenshots were rejected because they would be four more images to re-cut every time a ratio changes, with nothing enforcing it.

### 4. Unused slots get their own group, not a hidden state

Below the arrangement's own slots, a separate group lists any slot the arrangement does not render that still holds artwork, headed so that "kept, not deleted" is the first thing read, with the banners fully editable inside it.

This is the decision most likely to be got wrong by doing the obvious thing. Filtering the slot list by the current arrangement is one line and produces a screen where a merchant's promo banner has vanished — from a page whose entire purpose is showing them where their artwork is. They would conclude the switch deleted it. The group is unfolded when it is non-empty and absent entirely when it is not, so a store that has never used those slots sees nothing extra.

### 5. Capacity overflow is recounted, not re-explained

`HeroSlot.capacity` already exists so a banner past the limit is surfaced rather than silently unrendered, and the message is already written. It becomes per arrangement — `SPLIT_ONE` renders one side tile where `SPLIT_THREE` renders two — which means switching arrangement can push an existing banner into overflow. The existing message already says what happens; it now counts against `heroSlots(variant)`.

### 6. The panel never defaults the arrangement

The server resolves the variant on every read, so the value in the settings payload is always present and always valid. The picker renders it; it does not fall back.

`DEFAULT_HOME_CONFIG` in `lib/api/store-settings.ts` stays variant-free for the same reason the server's does, and the Home Sections normalisation that appends missing sections as `{ key, enabled: true }` has to be changed to **carry an existing entry's `variant` through** rather than rebuild entries — the same silent-drop hazard the server change calls out in its reconciler, one repository over.

### 7. Geometry of the four arrangements

Expressed as the current module expresses the one: `row` is the content width minus the container padding, gaps are 16, and everything else is a fraction or a ratio.

- `SPLIT_THREE` — side column `0.43` of the row; two square side tiles at `(column - gap) / 2`; promo at column width, ratio `43/20`; slider takes the remainder and matches the column's height. **Unchanged** from today's constants.
- `SPLIT_ONE` — side column `0.43`; one square tile at column width; slider takes the remainder. At a 1440 content width this is 592px tall against `SPLIT_THREE`'s 579, so the page below barely moves.
- `FULL_SLIDER` — slider at full row width, ratio `3/1`.
- `SLIDER_STACK` — slider at full row width, ratio `3/1`; three tiles at `(row - 2 × gap) / 3`, ratio `4/3`.

These must match `frontend`'s layout components exactly. `Hero.tsx` already carries the instruction — "The admin's `hero-slots.ts` derives its upload guidance from these same three ratios. Change one here and change it there" — and this change multiplies that obligation by four.

## Risks / Trade-offs

- **The two-editor `homeConfig` collision** in Decision 2. → Refetch-before-save narrows it to a round trip; the server's reconciliation bounds the damage to ordering, not structure.
- **Geometry drifts from the storefront.** Four arrangements, two repositories, nothing in either build that compares them. A mismatch is silent and shows up as a merchant's artwork being cropped. → The numbers are stated in one table here and in one comment block in `frontend`'s layout components; the storefront change's task 4.6 requires them to be written where this change can copy them verbatim. A build-time check would need a shared package neither repo has.
- **A merchant switches arrangement, sees a ratio warning on every slot, and concludes the panel is broken.** The warning is correct — their artwork really is a different shape now. → It stays advisory and says what will happen, as it does today. Nothing blocks.
- **A merchant hunts for the setting on Home Sections and gives up.** → Decision 2's read-only line with a link.
- **Radix `Select` on a settings page.** If the picker is implemented as a `Select` inside a form mounted before settings load, it clears the `values` reset and the save silently does nothing — a known failure in this panel. → The picker is a radio group of diagram cards, not a `Select`; and the page already gates on `useStoreSettings` having resolved.
- **Trade-off accepted:** four geometries to maintain instead of one. Bounded by Decision 1 keeping them in a single record, and it is the cost of not shipping a separate admin panel per vertical.

## Migration Plan

Ships **last** of the three. A picker that writes a variant the storefront cannot render lets a merchant choose something, save successfully and see no change — the worst of the three orderings.

No data migration. The first save from this screen writes a `variant` into an existing `homeConfig` array.

Rollback is reverting this change alone. Any variant already chosen stays in the database and keeps rendering on the storefront; the panel returns to quoting `SPLIT_THREE`'s guidance, which is wrong for a store that has moved — so a rollback here should be paired with resetting affected stores to the default arrangement, which is a single settings save per store.
