## Why

Authoring a product needs six reference records that the product form can only read: a category, a brand, any number of collections, a tax rule, an optional bundle deal, and the shop-wide attributes whose values become the product's variants. Every one of those pickers is a dead end the moment the record a merchant needs does not exist yet — they search "Nike", find nothing, and their only route forward is to abandon a part-filled product form, navigate to `/catalog/brands/new`, create the brand, navigate back, and re-enter everything they had typed. The product form is the one page in the panel that needs all six lists at once, so it is where that interruption is both most likely and most expensive: the cost is not the detour, it is the half-finished product thrown away to take it.

## What Changes

- **Each of the six reference pickers on the product form gains an inline create action.** The five dropdown pickers (Category, Brand, Collections, Tax rule, Bundle deal) carry a persistent `+ Add <noun>` entry at the foot of their option list — offered whether the list is full, filtered to nothing, or genuinely empty, since "I searched and it is not there" is exactly the moment it is needed. The attribute section of the variant editor carries the same action as a button beside its heading, because attributes are picked as checkbox groups rather than from a dropdown.
- **The action opens a small create modal and, on success, selects what was created.** The new record is set as the field's value (appended to the selection for the multi-value Collections field; for a new attribute, its values are pre-ticked, since the merchant just authored precisely the values they intend to sell). The dropdown closes onto the new selection, so the merchant is left where the search failed, with the search now succeeded.
- **The product form underneath is never disturbed.** No navigation, no route change, no remount, no form reset — every other field keeps what was typed, including on a modal the merchant cancels or one whose save the backend rejects.
- **Each modal collects a name plus the few extras that make the record usable, not the resource's whole form**: Brand (name, description, logo upload or URL, active); Category (name, parent — defaulted to the level the action was invoked from, description, image, active); Collection (name, visible); Tax rule (name, flat/percent, value); Bundle deal (name, buy quantity, free quantity); Attribute (name, swatch/label presentation, and its values, since an attribute with no values cannot produce a variant). SEO fields, sort order, category banner, and every edit or delete stay on the resource's own page — the modal only ever creates.
- **A rejected save keeps the modal open** with the typed values and the reason, matching what an authoring page already owes a merchant.
- **The `admin-shell` overlay rule gains an explicit edge.** `replace-admin-modals-with-pages` established that record authoring is a routed page and never an overlay, and named a narrow exempt set of "short in-context actions". Creating a reference record from inside another record's form is that kind of action and not a substitute for the resource's authoring page — but the rule as written does not say so, so this change states the exemption and its limits rather than leaving the two in silent contradiction.
- **Not changing**: any API module, hook signature, query key, or backend contract. Each modal calls the same `useCreateX` mutation its resource's own form page calls, and each `useCreateX` already invalidates a key that is a prefix of the picker's list key, so the lists refresh themselves.
- **Not changing**: the resource form pages, their routes, or the lists that link to them. Full authoring is untouched and remains the only place a reference record can be edited.

## Capabilities

Both paths below are already used by earlier, still-unarchived changes (`integrate-products-api`, `link-product-images-to-variants-admin`, `migrate-product-form-to-shadcn` for `catalog-management`; `build-admin-panel`, `replace-admin-modals-with-pages`, `migrate-product-form-to-shadcn` for `admin-shell`), but `openspec/specs/` is still empty — nothing in this project has been archived yet. So both deltas are written as `## ADDED Requirements` against paths that do not exist as main specs, and each carries a `## Purpose` so archive does not leave a `TBD` placeholder. The paths match those earlier changes exactly.

### New Capabilities

- `catalog-management`: creating a reference record from within the product form — which pickers offer it, what each modal collects, that the created record ends up selected, and that the product being authored survives the whole interaction untouched.
- `admin-shell`: the panel-wide rule this sits under — that an overlay may create a record referenced by the form the merchant is already filling in, what such an overlay may and may not do, and why that is not a return to overlay authoring.

### Modified Capabilities

None — there are no main specs to modify yet.

## Impact

- **New files** under `src/features/catalog/products/components/`: one `quick-create-dialog.tsx` shell (title, body, Cancel/Create, pending state, error line) and six small bodies — brand, category, collection, tax rule, bundle deal, attribute — each owning its own fields and calling its existing create hook.
- **`src/components/ui/combobox.tsx` and `multi-select.tsx`**: both gain an optional footer action rendered below the option list, present in all three list states (loading excepted), keyboard reachable, and not part of the option collection — so it cannot be committed by Enter as if it were a value, and does not shift the highlight index the `aria-activedescendant` contract depends on.
- **`src/features/catalog/products/product-form-page.tsx`**: five pickers gain the action and a handler that sets the created record as the field's value. Because a picker's option list refreshes asynchronously after the mutation, the page also holds the records created in this session and merges them into the options, so the new selection renders with its name immediately rather than falling back to the placeholder until the refetch lands.
- **`src/features/catalog/products/components/variant-editor.tsx`**: the attribute section gains the same action and pre-ticks the new attribute's values.
- **Unchanged**: `src/lib/api/**` (every create hook and query key already does what is needed), the six resource form pages and their routes, `src/routes/app-router.tsx`, `nav-config.ts`.
- **Risk — the category picker is hierarchical.** `CategoryParentPicker` renders one dropdown per level, so `+ Add category` has to mean "create under *this* level", and the created category has to land at the level it was created from. Getting the parent wrong puts a top-level category where a subcategory was meant, which is a data problem the merchant must then fix on another page.
- **Risk — two forms nested in one DOM tree.** The modal's own submit must not reach the product form's `<form>`, or creating a brand submits a half-filled product.
