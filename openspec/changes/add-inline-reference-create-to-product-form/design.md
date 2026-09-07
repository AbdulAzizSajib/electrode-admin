## Context

See proposal.md — Why. What shapes the approach is what already exists:

- `product-form-page.tsx` is one react-hook-form + zod form over six reference queries — `useCategoryTree`, `useBrands`, `useAllAttributes`, `useAllTaxRules`, `useAllCollections`, `useAllBundleDeals` — each rendered through `Combobox`, `MultiSelect`, `CategoryParentPicker`, or the `VariantEditor`'s checkbox groups.
- Every `useCreateX` hook already exists and already invalidates a query key that is a **prefix** of its picker's key (`['brands']` covers `['brands','list',p]`; `['categories']` covers `['categories','tree']`). So no API module needs touching, and the option lists refresh themselves after a create.
- `Combobox` and `MultiSelect` publish the highlighted option through `aria-activedescendant`, indexing into a `visible` array. Anything added to that array participates in the keyboard contract.
- `replace-admin-modals-with-pages` deliberately removed authoring overlays, including `brand-form-modal.tsx` and `category-form-modal.tsx`. This change must not reintroduce them by another name — the specs' limits (create only, reachable only from the referencing field, subset of fields) are what keep the two coherent.
- The `admin` app runs vitest; `product-form-page.test.tsx` already stubs every API hook, the router and the rich text editor, and raises the test timeout because the page is expensive to drive.

## Goals / Non-Goals

**Goals:**

- One dialog shell every quick-create reuses, so six modals cost six small field sets rather than six modals.
- The created record is visible and selected the instant the modal closes, without waiting on a refetch.
- Zero change to `src/lib/api/**` and zero change to the product form's submit payload.
- The create action is additive to `Combobox`/`MultiSelect` — a picker that does not pass it behaves exactly as today.

**Non-Goals:**

- A generic, config-driven "quick create anything" engine. Six hand-written bodies are less code than the configuration language that would replace them.
- Extending the pattern to the panel's other reference fields (purchase-order suppliers, campaign vouchers, stock warehouses). The spec permits it; this change does not do it.
- Editing or deleting from the modal, and any change to the six resource form pages.

## Decisions

### 1. A shell plus six bodies, not one configurable modal

`quick-create-dialog.tsx` owns everything the six share: the `Dialog`, the title, the pending state, the error line, Cancel/Create, and the "do not submit the form underneath" guarantee. Each body — `quick-create-brand.tsx` and friends — owns its own fields, its own zod schema, and its own `useCreateX` call, and hands back the created record.

*Alternative considered:* one modal driven by a field-descriptor array. Rejected because the six differ in every dimension that matters — brand posts multipart when a logo file is picked, category must omit `parentId` rather than send null, attribute has a repeatable sub-list, tax rule has a typed numeric value — so the descriptor format would end up with an escape hatch per resource, which is the hand-written body with extra indirection.

### 2. The create action is not an option

`Combobox` and `MultiSelect` gain `createAction?: { label: string; onSelect: () => void }`, rendered as a `<button>` **below** the option list, separated by a divider, outside the `visible` array.

This is the whole reason the prop exists rather than callers appending a synthetic `{ value: '__create__' }` option: an option in `visible` shifts the highlight indices that `aria-activedescendant` names, gets committed by Enter as if it were a value, renders a selection tick, and is filtered away by `matchesTerm` at exactly the moment it is needed — when what was typed matched nothing. As a sibling of the list it is reachable by Tab from the search field, invisible to the arrow keys, and rendered in all three settled states because it sits beside the branch, not inside it. It is withheld while `loading`, matching the spec.

### 3. Close the popover, then open the dialog

The action's handler closes the popover first and opens the dialog second. Radix's `Popover` and `Dialog` both take focus and both dismiss on an outside pointer press; a dialog opened inside a live popover gets its first click read as "outside the popover", and the two focus traps fight over the first field. Closing first leaves one layer at a time, and the merchant's mental model — the list steps aside for the form — matches.

The dialog is opened by state on the *product form*, not inside `Combobox`, so which modal is open is one piece of page state rather than six components' worth.

### 4. Stop the modal's submit from reaching the product form

`DialogContent` renders through a React portal, so the modal's DOM is not inside the product form's `<form>` element — but React's synthetic events propagate through the *React* tree, not the DOM tree, so a `submit` from the modal reaches the product form's `onSubmit` handler. The shell's own `<form onSubmit>` therefore calls both `preventDefault()` and `stopPropagation()`. Without the second call, creating a brand submits a half-filled product.

### 5. Merge created records into the options locally, rather than waiting on the refetch

`mutateAsync` resolves with the created record; the invalidation it triggers refetches the picker's list asynchronously. In the gap, `options.find(o => o.value === value)` misses and `Combobox` falls back to its placeholder — the merchant creates "Nike" and the field reads "Select a brand", which reads as a failed create.

So the page holds the records created during this session (`const [createdBrands, setCreatedBrands] = useState<Brand[]>([])`, one per resource) and builds each picker's options from `[...fetched, ...created]` de-duplicated by id with the fetched copy winning. Self-healing: once the refetch lands the created entry is a duplicate and drops out.

*Alternatives considered:* `queryClient.setQueryData` to patch the cached list — rejected because the brand list is keyed by its params object, so there is no single entry to patch, and a patch races the refetch it is trying to pre-empt. `await queryClient.refetchQueries(...)` before closing the modal — rejected because it makes every create wait on a second round trip, and a failed refetch hides a record that was successfully created.

### 6. The category picker takes the created categories as a flat extra list

`CategoryParentPicker` derives its levels from the nested `tree` and reconstructs the selected chain by walking `parentId` upward. A created category that is absent from the tree breaks both: the level renders without it, and the chain walk cannot place it.

Splicing into the nested tree means cloning it at every ancestor. Instead the picker gains `extraCategories?: Category[]`, appended when it builds its `flat`/`byId` maps, with `childrenOf(parentId)` unioning the tree's children with any extra whose `parentId` matches. One flat array in, no cloning, and the existing chain walk works unchanged because `byId` now knows the new category.

It also gains `onCreate?: (parentId: string | null) => void`, wired to each level's `createAction` and passing **that level's** parent — which is how the spec's "creates at the level it was invoked from" is satisfied. The page passes that `parentId` into the modal as the default parent, and on success calls `field.onChange(created.id)`; the chain re-derives itself.

### 7. Attributes: the page owns the list, the editor owns the button

`VariantEditor` renders the create action beside its heading and calls back up. The page merges the created attribute into the `attributes` it passes down and appends every one of its value ids to `selectedValueIds`. Nothing new rebuilds the combination table — the editor's existing `rebuildCombinations` already reacts to a changed selection and already carries over priced and stocked rows, which is exactly the spec's requirement. Selecting all values is deliberate: the merchant just authored precisely the values they intend to sell, so requiring them to immediately tick all of them again is a step with no decision in it.

### 8. Tests stay minimal and behavioural

Per the request: one or two tests per surface, happy path first. Concretely — the shell (submits once, keeps itself open with the reason on a rejected create), `Combobox` (arrow keys skip the action; the action shows when nothing matched), and one product-form test that creating a brand leaves it selected with the rest of the form intact. Around six tests total. The six bodies are not each given their own suite: they are the same shell with different fields, and the value is in the shell and the wiring.

## Risks / Trade-offs

- **Two overlay layers stacked** → Decision 3 keeps only one alive at a time; the dialog is page state so no picker can leave one orphaned.
- **A modal submit escaping into the product form** → Decision 4. This is the failure with the worst consequence in the change (a product created from a half-filled form), so it gets an explicit test.
- **The pattern reads as permission to bring back authoring overlays** → the `admin-shell` delta states the exemption's four limits, and the resource pages stay the only place a record is edited. The two deleted form modals are not resurrected.
- **`useBrands()` fetches a capped 100** → a shop past that cap can create a brand that the next page load's picker does not list. The session-local merge covers the current page only. Pre-existing behaviour of the cap, not introduced here and not fixed here; worth a follow-up if any shop approaches it.
- **Six modals is six more surfaces to keep working** → they share one shell, one error path, one pending path; a change to any of those is one file.
- **The category `extraCategories` merge duplicates the tree's own children if the refetch lands mid-interaction** → de-duplicated by id in the same pass as Decision 5, fetched copy winning.

## Migration Plan

Purely additive UI. No data migration, no backend change, no route change, no change to what the product form submits. Every new prop is optional, so a picker that does not pass `createAction` renders exactly as it does today. Rollback is reverting the component changes; nothing persisted depends on them, and records created through a modal are ordinary records that outlive it.
