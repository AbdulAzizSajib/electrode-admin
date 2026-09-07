## 1. Option-list plumbing

- [x] 1.1 Add an optional `createAction?: { label: string; onSelect: () => void }` prop to `src/components/ui/combobox.tsx`, rendered as a `<button type="button">` below the option list with a divider, outside the `visible` array — so it is skipped by the arrow keys, never committed by Enter, and reachable by Tab from the search field (design Decision 2).
- [x] 1.2 Render that action alongside all three settled states of the list — options, "nothing matches what you typed", "there are none yet" — and withhold it while `loading`.
- [x] 1.3 Make the action close the popover before invoking `onSelect`, so no dialog opens inside a live popover (design Decision 3).
- [x] 1.4 Add the same `createAction` prop to `src/components/ui/multi-select.tsx` with identical semantics; the popover stays open on option toggles but still closes for the create action.

## 2. The quick-create dialog shell

- [x] 2.1 Create `src/features/catalog/products/components/quick-create-dialog.tsx`: a `Dialog` + `DialogContent` shell taking `open`, `onOpenChange`, `title`, `submitLabel`, `pending`, `error`, `onSubmit`, and children for the fields.
- [x] 2.2 Give the shell its own `<form onSubmit>` that calls both `preventDefault()` and `stopPropagation()`, so a submit inside the portal never reaches the product form's `onSubmit` through the React tree (design Decision 4).
- [x] 2.3 Render Cancel and a submit button that shows a pending state and is disabled while a create is in flight, so a second activation cannot create a second record.
- [x] 2.4 Render the rejection reason inside the shell and keep the dialog open and its fields populated when a create fails.

## 3. The six create bodies

- [x] 3.1 `quick-create-brand.tsx` — name (required), description, logo via `SingleImageField` plus a logo URL field, active switch; calls `useCreateBrand()` with `{ input, logoFile }`, matching how `brand-form-page.tsx` builds its payload.
- [x] 3.2 `quick-create-category.tsx` — name (required), parent (defaulting to the `parentId` the action was invoked with, changeable), description, image, active; calls `useCreateCategory()`, omitting `parentId` entirely for a top-level category rather than sending null.
- [x] 3.3 `quick-create-collection.tsx` — name (required), visible switch; calls `useCreateCollection()`.
- [x] 3.4 `quick-create-tax-rule.tsx` — name (required), flat/percent, value; calls `useCreateTaxRule()`.
- [x] 3.5 `quick-create-bundle-deal.tsx` — name (required), buy quantity, free quantity; calls `useCreateBundleDeal()`.
- [x] 3.6 `quick-create-attribute.tsx` — name (required), swatch/label presentation, and a repeatable value list (label + optional swatch) requiring at least one value; calls `useCreateAttribute()`.
- [x] 3.7 Have every body resolve with the created record so the caller can select it, and leave editing and deleting out of all six.

## 4. Wiring the product form

- [x] 4.1 Hold the dialog that is open as one piece of page state in `product-form-page.tsx`, rather than one flag per picker.
- [x] 4.2 Hold the records created this session, one list per resource, and build each picker's options from `[...fetched, ...created]` de-duplicated by id with the fetched copy winning (design Decision 5).
- [x] 4.3 Wire `createAction` on the Brand, Collections, Tax rule and Bundle deal pickers; on success set the created record as the field's value — appended to the existing selection for Collections — and toast a confirmation naming what was created.
- [x] 4.4 Add `extraCategories?: Category[]` to `category-parent-picker.tsx`, folded into its `flat`/`byId` maps with `childrenOf` unioning tree children and matching extras, so a created category appears at its level and the chain walk can place it (design Decision 6).
- [x] 4.5 Add `onCreate?: (parentId: string | null) => void` to `category-parent-picker.tsx`, wired to each level's `createAction` and passing that level's parent; on success select the created category at the level it was created from, leaving the levels above unchanged.
- [x] 4.6 Add the create action beside the attribute section heading in `variant-editor.tsx`, calling back up to the page (design Decision 7).
- [x] 4.7 On attribute creation, merge the attribute into the page's list and append all of its value ids to `selectedValueIds`, letting the editor's existing `rebuildCombinations` carry over the rows already priced and stocked.

  Note: `category-parent-picker.tsx` also stopped hiding a trailing level that has no options **when `onCreate` is given**. Without that, "add a subcategory under a leaf" — a scenario the spec states — had no level to be invoked from. Callers that pass no `onCreate` (the category form page) render exactly as before.

## 5. Minimal tests

- [x] 5.1 `quick-create-dialog.test.tsx` — a valid submit calls the create once and closes; a rejected create keeps the dialog open with the reason and the typed values intact.
- [x] 5.2 Extend `combobox.test.tsx` — the arrow keys never land on the create action, and the action is still offered when what was typed matched nothing.
- [x] 5.3 Extend `product-form-page.test.tsx` — creating a brand from the Brand picker leaves that brand selected by name, with the rest of the form's values unchanged and no product create or update fired.

## 6. Verification

- [x] 6.1 Run `npm run test` and `npm run lint` in `admin/`, and `npm run build` to typecheck the new props.

  All three clean: 132/132 tests, lint 0 errors (the 5 remaining warnings are the pre-existing `form.watch` ones on voucher/banner/product/purchase-order pages), build succeeds. One full-suite run saw `resource-form-page.test.tsx` time out at the 5s default under parallel load; it passes in isolation and on a repeat full run, and is the scheduling artifact `product-form-page.test.tsx` documents at its head — not a regression from this change.

  Three implementation details differ from the design, all forced by the lint rules and none changing behaviour:
  - `CreateActionButton` and `ComboboxCreateAction` live in `src/components/ui/create-action-button.tsx`, not inside `combobox.tsx`. A second component in that file makes the React Compiler lint re-analyse `Combobox` and report the highlight-clamping effect it has always had. Verified by bisection: the original file lints clean, the file with the extra component does not.
  - The six bodies seed their state at mount instead of resetting in an effect on `open`. The product form renders each only while open, so every opening is already a fresh mount — and `set-state-in-effect` is a lint error. Same behaviour, one less effect.
  - `createErrorMessage` moved out of the shell to `src/lib/utils/error-message.ts` as `errorMessage`; a non-component export alongside components trips `react-refresh/only-export-components`.

- [ ] 6.2 Drive the page once by hand: search a brand that does not exist, create it from the picker, confirm it is selected and the part-filled product is intact, then save the product and confirm the payload carries the new brand id.

  Not done — needs a browser and a live backend, neither available here. 5.3 asserts the same sequence against the real page with the API stubbed, so what is unverified is specifically the round trip to the running server.
