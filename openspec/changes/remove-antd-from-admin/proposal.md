## Why

The panel has run two form stacks side by side since `replace-admin-modals-with-pages` deliberately postponed the choice: antd `Form` for the catalogue and content pages, react-hook-form + zod over `components/ui` for everything else. `ResourceFormPage` and `ResourceFormPageRhf` are the same 170 lines of save semantics written twice, over one shared `ResourceFormLayout`, and every guarantee the panel makes about authoring — a refused save keeps what you typed, the reason sits above the fields, create-then-stay hands off to the edit form — has to be implemented and tested twice or it drifts.

`migrate-product-form-to-shadcn` settled the direction in practice. It moved the panel's largest and busiest form (~1216 lines) onto react-hook-form and, in doing so, built the four kit primitives whose absence was the actual reason the other pages stayed on antd: `combobox`, `multi-select`, `radio-group` and a dismissible `alert`. That change is 52/56 tasks done with only manual QA outstanding. The remaining twelve antd pages are now the minority stack, they need no primitive that does not already exist, and the second form stack is pure carrying cost.

Note that `admin/CLAUDE.md` and the header comments in `resource-form-page-rhf.tsx` and `resource-form-layout.tsx` all still describe antd as the migration *target*. That was true when written and is now backwards; correcting it is part of this change.

## What Changes

- Migrate the twelve remaining antd form pages to react-hook-form + zod over `components/ui`, field for field: `category`, `brand`, `brand-bulk-create`, `attribute`, `collection`, `tax-rule`, `bundle-deal`, `blog`, `testimonial`, `page`, `landing-page`, `font`. No field is added, removed, renamed or reordered, and no validation message changes wording.
- Migrate `landing-page-lists.tsx` — six `Form.List` editors (media, highlights, faqs, quotes, trust badges, delivery zones) — onto `useFieldArray`, keeping add / remove / reorder, the `MAX_DELIVERY_ZONES` cap and the "last delivery zone cannot be removed" rule.
- Delete `ResourceFormPage`; `ResourceFormPageRhf` becomes the panel's single form scaffold. **BREAKING** for the eleven pages that call it — their `children` render prop and `emptyValues` prop are replaced by the caller owning its own `useForm` and zod schema, the pattern `supplier-form-page` already uses.
- Add two kit primitives the twelve pages need and the kit lacks: `number-input` (the `''` → `undefined` clearing behaviour currently inlined four times in `product-form-page.tsx`, extracted and reused) and `color-input` (replacing antd `ColorPicker` in the attribute values editor).
- Convert `resource-form-layout.tsx`'s two antd `Alert` usages to the kit `Alert`, so the shared layout carries no antd.
- Drop antd entirely: remove `ConfigProvider` from `admin-font-provider.tsx`, delete `lib/antd-theme.ts`, and remove `antd` from `package.json`. **BREAKING** — nothing may import from `antd` after this change.
- Delete `product-form-page-copy.tsx`, the unrouted 1216-line antd duplicate of the product form. It is already flagged as task 9.1 of `migrate-product-form-to-shadcn` and becomes unbuildable once antd is gone.
- Correct the stale "antd is the migration target" claims in `admin/CLAUDE.md` and in the two scaffold header comments.
- **Behaviour preserved, not re-litigated.** Every guarantee the twelve pages make today is an acceptance criterion of the rewrite: the attribute editor's ordering, its duplicate-label refusal, its at-least-one-value rule and its force-removal confirmation; slug auto-fill stopping once the merchant types their own; the tax rule's label and bounds following its type; the delivery zone key pattern and distinctness; the media row's video/image branch.

### Non-goals

- Redesigning any page. Layouts, card grouping, field order and copy stay as they are.
- Changing any API contract, payload shape or server behaviour.
- Finishing `migrate-product-form-to-shadcn`'s outstanding manual QA (tasks 8.4–8.6). That change is archived on its own terms; this one only inherits its primitives.
- Touching the 16 pages already on react-hook-form, beyond retrofitting them to the extracted `number-input` where they inline the same pattern.

## Capabilities

`openspec/specs/` is empty — no change in this project has been archived yet — so both deltas below are written as `## ADDED Requirements` against paths that do not exist as main specs, each carrying a `## Purpose`, exactly as `migrate-product-form-to-shadcn` and `add-inline-reference-create-to-product-form` do. The paths must match those earlier changes.

### New Capabilities

- `admin-shell`: the panel-wide authoring behaviour every form page inherits once there is one stack — numeric fields that clear to unset rather than to zero, repeatable row groups with add / remove / reorder and a floor on how few rows may remain, colour values entered as hex, and validation failures that belong to a whole list rather than to one field.
- `catalog-management`: the attribute values editor, whose ordering, duplicate detection, presentation-gated swatch and force-removal confirmation are the behaviours most easily lost in a `Form.List` → `useFieldArray` rewrite.

### Modified Capabilities

None — there are no main specs to modify yet.

## Impact

**Rewritten (12 pages + 1 component, ~2887 lines)**
- `src/features/catalog/` — `categories/category-form-page.tsx` (200), `brands/brand-form-page.tsx` (104), `brands/brand-bulk-create-page.tsx` (123), `attributes/attribute-form-page.tsx` (254), `collections/collection-form-page.tsx` (84), `tax-rules/tax-rule-form-page.tsx` (109), `bundle-deals/bundle-deal-form-page.tsx` (108)
- `src/features/ui/` — `blog/blog-form-page.tsx` (269), `testimonials/testimonial-form-page.tsx` (247), `pages/page-form-page.tsx` (207), `landing-pages/landing-page-form-page.tsx` (634), `landing-pages/landing-page-lists.tsx` (447), `fonts/font-form-page.tsx` (101)

**Added**
- `src/components/ui/number-input.tsx`, `src/components/ui/color-input.tsx`, each with a test

**Modified**
- `src/components/crud/resource-form-layout.tsx` — antd `Alert` → kit `Alert`; header comment corrected
- `src/components/crud/resource-form-page-rhf.tsx` — header comment corrected; becomes the only scaffold
- `src/features/ui/fonts/admin-font-provider.tsx` — `ConfigProvider` removed, leaving only the `--font-sans` variable and the injected `<link>`
- `admin/CLAUDE.md` — the migration-target claim

**Deleted**
- `src/components/crud/resource-form-page.tsx` (169) and `resource-form-page.test.tsx`
- `src/lib/antd-theme.ts` (39)
- `src/features/catalog/products/product-form-page-copy.tsx` (1216, dead)

**Dependencies**
- `antd` removed from `package.json`. No dependency is added — `@radix-ui/react-radio-group` arrived with the previous change, and `number-input` / `color-input` are built on the existing `Input`.

**Risk**
- `landing-page-lists.tsx` is the sharpest edge: six repeatable editors, one list-level validator, a nested `shouldUpdate` branch on each media row's type, and a minimum-count rule. `Form.List` gives array-level validation and `Form.ErrorList` for free; zod plus `useFieldArray` does not, so the array-level errors must be routed deliberately or they vanish silently.
- `category-parent-picker.test.tsx` mounts the picker inside an antd `Form` to drive it. The picker itself is already shadcn; the test harness is not, and must move or the suite fails to compile once antd is gone.
- The panel's known Radix `Select` + react-hook-form hazard — a `Select` mounted before the record arrives clears the `reset` and silently blocks the save — now applies to twelve more edit pages. `ResourceFormLayout` already blocks rendering on `isLoading`, which is what prevents it; that guard must not be weakened.
- No test covers any of the twelve pages today. The rewrite carries tests for the behaviours the specs pin.
