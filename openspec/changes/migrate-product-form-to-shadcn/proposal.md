## Why

The product authoring page is the only screen in the panel that still runs on antd's form engine — `Form.useForm`, `Form.Item`, `Form.List`, `Form.useWatch` — while eighteen other pages in the same panel are already react-hook-form + zod over the shadcn primitives in `components/ui`. It is also the panel's largest and highest-traffic form, so the split costs the most exactly where it hurts: two validation models, two field-error conventions, two sets of spacing hacks (`[&_.ant-form-item]:mb-0!`, a hand-measured `h-[32px]` matched to antd's `controlHeight`, `--spacing: 0.22rem` disagreeing with antd's 4px grid), and a page whose look drifts from the rest of the panel on every theme change.

The page has also accumulated real behaviour that only exists because antd behaves the way it does — a bespoke `reportValidationFailure` built around `form.scrollToField`, and a hand-declared `ValidationFailure` interface for a type living in an antd transitive dependency the project cannot resolve. Moving to the panel's own form stack removes the workarounds rather than porting them.

## What Changes

- Rewrite `product-form-page.tsx` on react-hook-form + zod + `components/ui/form`, matching the pattern already established by `purchase-order-form-page` and `resource-form-page-rhf`. Field-for-field, section-for-section — no fields added, removed, renamed, or reordered.
- Rewrite the page's two antd-bearing children on shadcn primitives: `components/variant-editor.tsx` (antd `Alert`, `Checkbox`, `Input`, `InputNumber`, `Modal`) and `components/media-sidebar.tsx` (antd `Alert`, `Input`).
- Rewrite `components/forms/tag-input.tsx` (antd `Select mode="tags"`) as a shadcn chip-input with the same server-backed suggestions, same case-insensitive de-duplication, and the same `value: string[]` / `onChange(string[])` contract.
- Convert `category-parent-picker.tsx`'s internal antd `Select`s to shadcn. Its public contract is already `value`/`onChange`, so it keeps working unchanged inside `category-form-page`'s antd `Form.Item` — one component, not a fork.
- Add the four `components/ui` primitives the page needs and the kit does not have: `alert` (dismissible, with info/warning/destructive variants), `radio-group` (the Yes / No / Not stated tri-state), `combobox` (type-to-filter single select, for Brand, Tax rule and Bundle deal), and `multi-select` (Collections). These are shared kit additions, available to the rest of the panel.
- Keep antd installed. `main.tsx`'s `ConfigProvider`, `lib/antd-theme.ts` and the twenty-odd other antd files stay exactly as they are; this change removes antd from the product form's subtree only.
- **Behaviour preserved, not re-litigated.** Every guarantee the current page makes is an acceptance criterion of the rewrite: a refused save keeps every entered value with the reason banner above the fields; an edit-mode save is refused when the product has images on record and the form holds none; the inventory half stays gated on the product existing; exactly one image ends up primary; a load failure never falls through to an empty form; SKU auto-fill stops the moment the merchant types their own; combinations that cannot carry over are confirmed before they are lost.

### Non-goals

- Removing antd from the panel. The other 20 antd files, the `ConfigProvider` and the dependency itself are out of scope.
- Changing the product API contract, the payload shape, or anything server-side.
- Redesigning the page. The two-column layout, the seven cards and the media sidebar stay as they are.
- `product-form-page-copy.tsx` — a byte-identical, unrouted duplicate of the page. It is dead code and not migrated; see Impact.

## Capabilities

Both paths below are already used by earlier, still-unarchived changes (`integrate-products-api`, `link-product-images-to-variants-admin` for `catalog-management`; `build-admin-panel`, `replace-admin-modals-with-pages` for `admin-shell`), but `openspec/specs/` is empty — no change in this project has been archived yet. So the deltas are written as `## ADDED Requirements` against paths that do not exist as main specs yet, and carry a `## Purpose` so archive does not leave a `TBD` placeholder. The paths must match those earlier changes exactly.

### New Capabilities

- `catalog-management`: how the panel lets a merchant author a product — the authoring page's validation reporting, reference-list failures, keyword entry, tri-state facts, searchable pickers, the combination-loss confirmation and the destructive-save guards.
- `admin-shell`: the panel-wide form and messaging behaviour every authoring page inherits — dismissible page-level messages, narrowable option lists, multi-value fields, and keyboard-operable option groups.

### Modified Capabilities

None — there are no main specs to modify yet.

## Impact

**Rewritten**
- `src/features/catalog/products/product-form-page.tsx` (~1216 lines)
- `src/features/catalog/products/components/variant-editor.tsx` (~360 lines)
- `src/features/catalog/products/components/media-sidebar.tsx` (~343 lines)
- `src/components/forms/tag-input.tsx` (~95 lines)
- `src/features/catalog/categories/category-parent-picker.tsx` (~118 lines) — internals only; shared with `category-form-page`, which must keep working

**Added**
- `src/components/ui/alert.tsx`, `radio-group.tsx`, `combobox.tsx`, `multi-select.tsx`

**Untouched but adjacent**
- `image-upload-field.tsx` and `variant-combinations.ts` are already antd-free and keep their contracts (`PendingImage`, `SHARED_VARIANT_KEY`, `rebuildCombinations`); `variant-combinations.test.ts` must stay green.
- `src/features/catalog/products/product-form-page-copy.tsx` — an unrouted, byte-identical copy of the page. Nothing imports it and no route lazy-loads it. Deleting it is proposed as an optional task; leaving it in place is also safe, since antd stays installed.

**Dependencies**
- `@radix-ui/react-radio-group` (not yet installed) for the tri-state field.
- One decision deferred to design.md: whether the combobox is built on `cmdk` (the canonical shadcn dependency, not yet installed) or hand-rolled on the Popover and Input already present. Both are viable; design.md picks one and says why.
- No dependency is removed. `antd` stays in `package.json`.

**Risk**
- The page owns four destructive-save guards that exist because it submits `images`, `variants` and `options` as the *complete* intended set. Re-implementing state sync on react-hook-form is where those guards are most easily lost, which is why the delta spec states them.
- No test covers this page today (`variant-combinations.test.ts` covers the matcher only), so the rewrite carries the tests that pin its guards.
