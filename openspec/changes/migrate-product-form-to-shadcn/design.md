## Context

See proposal.md — Why.

What shapes the approach here is that the target is not a greenfield form. Eighteen pages in this panel are already react-hook-form + zod over `components/ui`, and two of them — `resource-form-page-rhf.tsx` and `purchase-order-form-page.tsx` — already answer most of the questions this rewrite raises: how a refused save is reported, how a record is synced into the form once it loads, how `useFieldArray` handles a repeating section, how a `z.coerce.number()` field is bound to `<Input type="number">`. The product form is bigger than any of them, but it is not different in kind.

Three constraints are specific to this page:

1. **It submits complete sets.** `images`, `options` and `variants` are sent as the *entire* intended set — the server deletes anything not resubmitted. Four separate guards exist in the current file because of this, and each one is a comment explaining a bug that already happened once. Whatever the form library, those guards have to survive.

2. **Half its state is not form state.** Combination rows, image rows, picked files and the video live in React state, not in antd fields, because combinations are *derived* from the attribute selection and two owners of derived data is the exact ambiguity the old "Generate variants" button created. That split does not change — react-hook-form owns the product; component state owns the inventory half.

3. **The current sync is render-phase, not an effect.** `product-form-page.tsx` adjusts `rows` / `images` / `video` during render, keyed on `${product.id}:${product.updatedAt}`, with a comment recording that seeding the key from `product` instead of `undefined` silently deleted every image on save when the query cache was warm. That is a live bug fix, not a stylistic choice.

The UI kit is missing four things the page needs: a dismissible alert, a radio group, a type-to-filter select, and a multi-select. `components/ui/select.tsx` is Radix Select, which is neither searchable nor multiple.

## Goals / Non-Goals

**Goals:**

- One form library on this page and its subtree, matching the panel's existing react-hook-form + zod + `components/ui/form` stack.
- Every guarantee in `specs/catalog-management/spec.md` verifiable by a test, since none is covered today.
- The four new primitives land in `components/ui` as general kit, usable by the next page, not as one-offs inside the product feature.
- `category-parent-picker.tsx` stays a single component serving both the migrated product form and the still-antd category form.

**Non-Goals:**

- Removing antd, its `ConfigProvider`, or `lib/antd-theme.ts`. See proposal.md — Non-goals.
- Changing the payload, the API surface, or `variant-combinations.ts` and its passing test.
- Any visual redesign. Card structure, section order, the two-column `xl:grid-cols-[minmax(0,1fr)_340px]` layout and the copy all stay.

## Decisions

### Decision 1 — react-hook-form + zod directly on the page, not through `ResourceFormPageRhf`

`ResourceFormPageRhf` wraps `ResourceFormLayout`, which is itself still antd, and it assumes a shape this page does not have: one card of fields, a `toValues(record)` mapping, and save semantics driven by a `noun` and a `listPath`. The product page has seven cards, a media sidebar living *outside* the field column, a create/edit gate on half its sections, its own `saveError` semantics, and a save that navigates to `/catalog/products/:id/edit` rather than to `${listPath}/${id}`.

Bending the shared wrapper to fit would change a component eight other pages depend on, inside a change whose whole point is to be a like-for-like swap. So: `useForm` on the page, `<Form {...form}>` + `<form>` as `purchase-order-form-page` does, and the save/navigate/error logic ported from the current file rather than delegated.

*Alternative considered:* extend `ResourceFormPageRhf` with slots for a sidebar and a custom submit path. Rejected — it makes the blast radius eight pages instead of one, and `ResourceFormPageRhf`'s own docblock already says it is scheduled for deletion.

*Alternative considered:* keep antd's `Form` and swap only the visual components. Rejected — `Form.Item`'s clone-and-inject contract is what forces `ValidationFailure` to be hand-declared and what the `[&_.ant-form-item]:mb-0!` and `h-[32px]` hacks exist to work around. Leaving it in place leaves all of that.

### Decision 2 — The schema is one zod object; `z.input` for values, `z.output` for submit

Following `purchase-order-form-page`: `type Values = z.input<typeof schema>` for `useForm`, `type OutputValues = z.output<typeof schema>` for the submit handler, so coercion happens once at the boundary.

The numeric fields need care that the existing pages get wrong. `<Input type="number">` yields `''` when cleared, and `z.coerce.number()` turns `''` into `0` — which would save a cleared optional "Regular price" as ₹0 rather than as "not on offer", and the same for "Purchase price". antd's `InputNumber` returned `null` and never had this problem, so the migration introduces the hazard.

So optional numbers go through a preprocess that maps empty string and `null` to `undefined` before the number check:

```ts
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0, 'Cannot be negative').optional(),
)
```

`offerPrice` stays required (`z.coerce.number().min(0)`), and `lowStockThreshold` keeps its default of 5. This is what `admin-shell`'s "Numeric fields accept an empty value distinctly from zero" requirement pins.

*Alternative considered:* a `NumberInput` kit component that holds `number | undefined` and never surfaces `''`. Better long-term, and worth doing when a second page needs it — but it is a new controlled-input contract to design and test inside a migration, and the preprocess covers the same requirement in four lines. Noted in Open Questions.

### Decision 3 — Combination, image, video and upload state stay in React state, and stay render-phase-synced

Unchanged from today, deliberately. `rows`, `selectedValueIds`, `images`, `video`, `pendingImagesState` and `uploadsFor` are ported verbatim, including:

- `syncedProductKey` initialised to `undefined`, **not** to `productKey` — the comment on that line records that seeding it from `product` marked the product as already-synced on a warm cache, so the gallery loaded empty and the next save deleted every image row. This is the single most dangerous line to "clean up" during the rewrite.
- The key being `${product.id}:${product.updatedAt}`, so a save returning fresh server values (new variant ids, generated slug) re-syncs.
- `variantKeySeq` monotonic and never derived from list length.

react-hook-form's own reset stays separate and effect-driven, replacing the current `form.setFieldsValue` effect. `useForm`'s `values` option (as `purchase-order-form-page` uses) is the cleaner spelling and re-syncs when `product` changes, so the effect goes away entirely for the field half.

*Alternative considered:* move the inventory half into the form as `useFieldArray`. Rejected for the reason the current file gives — combinations are derived from the attribute selection by `rebuildCombinations`, and a form array would make the form a second owner of derived data.

### Decision 4 — Validation reporting: `shouldFocusError` plus a counted banner, with a manual fallback for custom controls

react-hook-form focuses the first errored field automatically (`shouldFocusError`, on by default), which replaces `form.scrollToField` and lets the hand-declared `ValidationFailure` interface go.

But it only focuses fields whose `ref` reaches a focusable DOM node. Four of this page's controls are custom and do not forward one: `RichTextEditor` (description is required), `CategoryParentPicker` (category is required), `TagInput`, and the specification rows' inputs are fine but the section is not. So the invalid-submit handler additionally reads `Object.keys(errors)`, and for a name not focusable it scrolls the field's `FormItem` into view by id.

The banner text mirrors today's wording exactly — one error quotes the field's own message plus "it is highlighted below", more than one gives the count — because `specs/catalog-management` pins both forms.

*Alternative considered:* forward refs from the four custom controls. Correct, and cheap for `TagInput`; awkward for `RichTextEditor` (Tiptap) and `CategoryParentPicker` (renders N selects, so "the field" has no single focus target). The scroll fallback covers all four uniformly; ref-forwarding can follow.

### Decision 5 — Build the combobox on the existing Popover + Input; do not add `cmdk`

Three fields need type-to-filter (Brand, Tax rule, Bundle deal) and one needs multi-select (Collections). `cmdk` is the canonical shadcn dependency for this and would give keyboard navigation, filtering and `aria-activedescendant` for free.

Against it: this change's stated purpose is to reduce the panel's UI-library surface, and adding a second option-list engine while antd's is still installed moves in the wrong direction. The panel already has `@radix-ui/react-popover`, `Input`, and a scroll container idiom; a `Combobox` over them is roughly 120 lines, and `MultiSelect` reuses it with `Badge` chips for the selections. The three consumer lists here are small (brands, tax rules, bundle deals — tens of rows, all already fetched), so `cmdk`'s virtualisation and scoring buy nothing.

The accessibility work is the real cost and is not optional: `role="combobox"` on the trigger with `aria-expanded` and `aria-controls`, `role="listbox"`/`role="option"` on the list, `aria-activedescendant` tracking the highlighted option, ArrowUp/ArrowDown/Home/End/Enter/Escape handled, and typing that does not steal Escape from the popover. That is what `specs/admin-shell` — "Long option lists are narrowable by typing" — makes testable.

*Alternative considered:* add `cmdk`. Cheaper to write, and if the combobox's keyboard handling turns out to be a time sink during apply, switching is a contained swap behind the same `<Combobox>` props. Recorded here so that decision does not have to be re-derived.

*Alternative considered:* leave Brand and Tax rule as plain Radix `Select` with no search. Rejected — the current page has `showSearch` on all three, so dropping it is a regression, and brands is the list most likely to grow past scrolling.

### Decision 6 — `TriStateField` becomes a Radix radio group, so `@radix-ui/react-radio-group` is added

antd's `Radio.Group optionType="button"` gives a segmented control with roving focus. The panel has no equivalent; `Tabs` is the closest primitive but carries tab/tabpanel semantics that are wrong for a form value.

`@radix-ui/react-radio-group` is one small package from a scope already installed eleven times over, and it gives the single tab stop, arrow-key movement and group labelling that `specs/admin-shell` — "Short mutually exclusive choices are one keyboard group" — requires. Styled as segmented buttons so it looks like what it replaces.

The tri-state encoding is unchanged: `'yes' | 'no' | 'unset'` at the control, `true | false | null` in the form value, because `null` ("not said") is not `false`.

### Decision 7 — `category-parent-picker.tsx` is converted in place, not forked

Its public contract is already `{ value, onChange }`, and antd's `Form.Item` injects exactly those two props into whatever child it wraps — it does not care that the child renders Radix internally. So swapping its antd `Select`s for the new `Combobox` leaves `category-form-page` (still antd) working unchanged, and both pages keep one implementation.

This is the one file in this change that a still-antd page depends on, so it gets its own verification step in tasks.md: exercise the category form's parent picker after the swap, not just the product form's.

*Alternative considered:* fork a shadcn copy for the product form. Rejected — two copies of the ancestor-chain walk, and the antd copy becomes dead the moment `category-form-page` migrates.

### Decision 8 — `TagInput` is rebuilt as a chip input over the same combobox, keeping its contract

`Select mode="tags"` does three things at once: shows chips, filters server-provided suggestions, and accepts free text on Enter or comma. The rebuild keeps `{ value: string[], onChange(string[]) }` and the existing `normalise()` function verbatim — that function is where the two reference-panel bugs the docblock names are already fixed (`[object Object]` on Enter, and substring de-duplication removing "wireless" when removing "less"). It is pure and gets a unit test rather than a rewrite.

`filterOption={false}` becomes "do not filter locally" — `useTagSuggestions(term)` already filters server-side, and re-filtering client-side would hide suggestions the server matched on a different part of the name.

### Decision 9 — `Alert` gets a `dismissible` prop; severity is icon + text, not colour

Seven alerts across the three files, in three severities (`info`, `warning`, `error` → `default`, `warning`, `destructive`) with a heading and an optional description, and one of them (`saveError`) closable. shadcn's canonical `alert.tsx` has variants and a title/description but no dismiss, so the kit component takes an optional `onDismiss` and renders a close control only when given one.

Mapping, so it is not re-litigated per site:

| Current | Severity | Dismissible |
| --- | --- | --- |
| `saveError` banner | destructive | yes |
| `failedLists` banner | warning | no — the condition persists until reload |
| load-failure banner | destructive | no |
| "Available after saving" ×2 (variants, gallery) | info | no |
| "No attributes defined yet" | info | no |

### Decision 10 — The carry-over confirmation uses the kit's existing `ConfirmDialog`

antd's `Modal` with `okButtonProps={{ danger: true }}` maps onto `components/ui/confirm-dialog.tsx`, already used by eight list pages for exactly this shape (destructive confirm, cancel, custom labels). No new primitive; the labels "Apply anyway" / "Leave things as they are" and the destructive styling carry over.

### Decision 11 — Tests are part of the change, not a follow-up

The page has no test today. Since the rewrite's contract is "behaviour is unchanged" and the delta spec now writes that behaviour down, the tests are what make the claim checkable. `@testing-library/react`, `user-event`, `vitest` and `jsdom` are already set up, and `resource-form-page-rhf.test.tsx` is the pattern to follow.

The four destructive-save guards get tests first, because they are the ones whose failure is silent and permanent.

## Risks / Trade-offs

- **The render-phase product sync is rewritten and the image-deletion bug returns.** A warm query cache makes `product` non-undefined on the first render; seeding `syncedProductKey` from it skips the sync, and the next save sends `images: []` over a product that has them. → Port those lines verbatim, keep the comment, and write the regression test *first*: mount the page with the detail query pre-populated in the `QueryClient` and assert the gallery is populated and the submitted payload carries the image rows.

- **Cleared optional prices save as zero.** Decision 2's hazard, introduced by the move from `InputNumber` to `<Input type="number">`. → `optionalNumber` preprocess, plus a test that clears "Regular price" and asserts `sellingPrice` is absent from the payload rather than `0`.

- **The hand-built combobox has weaker keyboard support than antd's.** Decision 5 trades a dependency for ~120 lines that have to get `aria-activedescendant` and Escape handling right. → Build it once in `components/ui`, test it directly against the `admin-shell` scenarios, and treat `cmdk` as the pre-approved fallback if it fights back.

- **`category-parent-picker` breaks the category form.** It is shared with a page not being migrated. → Its own verification task; the category form's parent chain is exercised after the swap.

- **Scope creep into the other 20 antd files.** The new `Alert`, `Combobox`, `MultiSelect` and `RadioGroup` will look like obvious replacements for antd usages in neighbouring pages. → They are kit additions only; no page outside this change's file list is touched.

- **Validation focus silently stops working for the four custom controls.** `shouldFocusError` fails quietly — no error, just a button that looks frozen, which is the exact bug the current `reportValidationFailure` was written to fix. → The scroll fallback in Decision 4, plus a test that submits with an empty Description (a `RichTextEditor` field) and asserts the section is scrolled to and the banner names it.

## Migration Plan

Single deploy, no data migration, no feature flag. The unit of work is the page and its four collaborators, and the natural rollback is reverting those files — antd stays installed throughout, so nothing outside the file list can break.

Order matters, because it keeps the tree compiling:

1. Kit primitives first (`alert`, `radio-group`, `combobox`, `multi-select`) with their own tests. Nothing consumes them yet.
2. `category-parent-picker` and `tag-input` next — leaf components with narrow contracts, and the picker is verified against the *unmigrated* category form at this point.
3. `media-sidebar` and `variant-editor` — still consumed by the antd page, so they are exercised in place before the page itself moves.
4. The page last, when everything it renders is already shadcn and already verified.

At every step the app builds and both product routes work; there is no window where the page is half-migrated.

## Open Questions

- Whether a `NumberInput` kit component (holding `number | undefined`, never surfacing `''`) should replace the `optionalNumber` preprocess. Deferrable: the preprocess satisfies the requirement, and a kit component is a strictly additive refactor once a second page wants it.
- Whether to delete `product-form-page-copy.tsx`. It is unrouted and unimported, so it affects nothing either way; tasks.md carries it as an optional step for the user to accept or decline.
- The page header carries a docblock describing itself as pinned to the top of the scroll port — "every way out of it lives up here" — but its class list is `flex flex-col gap-3 bg-background px-4 pb-4`, with no `sticky` and no `top-0`. The behaviour the comment describes does not currently happen. This is a pre-existing discrepancy, not something the migration introduces, so it is deliberately **not** specified and **not** fixed here; flagged so it is a decision rather than an oversight.
