## Why

The product form treats images and variants as two unrelated lists. An admin uploads four photos and defines two variants, and nothing in the form says which photo shows which variant — because until now the API had no way to express it. The storefront consequently renders one flat gallery whose thumbnails have no relationship to the option buttons beside them.

The API change (`electrode-server` / `link-product-images-to-variants`) adds that relationship: each `ProductImage` may name one variant, or none to mean "shared across all variants". Nothing produces that data yet. Without an admin UI to assign it, the column stays null on every row and the storefront work has nothing to render.

## What Changes

- **Every image row gains a variant picker.** Both image inputs get one: the URL rows in the `images` `Form.List`, and the pending-file rows in `ImageUploadField`. The choice is the product's variants plus a "Shared — all variants" option, which is the default and means no association.
- **The picker only appears for variable products.** A `SIMPLE` product has no variants to choose from, so the control is hidden rather than shown empty — matching how the variants section itself is already conditional on `type === 'VARIABLE'`.
- **Variants are referenced by id when they exist and by position when they do not.** On edit, existing variants have real ids and the picker submits `variantId`. On create — and for variants added during an edit — no id exists yet, so the picker submits `variantIndex`, the variant's position in the submitted `variants` array. The form builds both arrays in one pass so the indices cannot drift.
- **Picking a variant that is then deleted degrades to shared.** Removing a variant row clears the picker on any image that named it, rather than leaving the form holding a reference the API would reject.
- **Uploaded files carry their assignment in the same request.** `imageSlots[i]` gains the variant reference, so a file uploaded and assigned in one submit lands on the right variant without a follow-up edit.
- **The product detail page shows which variant each image belongs to.** Read-only, so an admin can verify an assignment without entering edit mode.
- **The variant picker is unavailable until at least one variant is named.** A variant with an empty `name` cannot be labeled in a dropdown, so the picker lists only variants that have one, and says so when none do.

## Capabilities

### New Capabilities
- `catalog-management`: `openspec/specs/` has no capability specs yet — the earlier `build-admin-panel`, `integrate-categories-api` and `integrate-products-api` changes that established this capability were never archived — so this change adds its requirements fresh under the same capability id, keeping product-form requirements in one file when those changes are eventually archived together. Scoped here to assigning a product image to a variant: the per-image control, its conditional appearance, how the assignment is submitted on create versus edit, and how it is displayed read-only.

### Modified Capabilities
<!-- None. `catalog-management` does not exist under `openspec/specs/` yet, so these requirements are added rather than modified. -->

## Impact

**Depends on**
- `electrode-server` change `link-product-images-to-variants` must ship first. This change produces data the API cannot accept until then — submitting `variantId` / `variantIndex` against the current API means zod strips the fields and the assignment is silently lost, which is worse than not offering the control.

**Code**
- `src/lib/api/products.ts`: `ProductImage` gains `variantId`; `ImageSlotInput` and the image entries in `ProductInput` gain `variantId` / `variantIndex`. No change to `buildProductForm`'s multipart shape — the new fields ride inside the existing `data` JSON blob.
- `src/features/catalog/products/product-form-page.tsx`: the form-local `ImageValue` type, the `images` `Form.List` row, the submit mapper, the variant-delete handler, and the edit-mode load that maps `product.images` back into form values.
- `src/features/catalog/products/components/image-upload-field.tsx`: `PendingImage` gains the variant reference; the component needs the variant list and a change handler for it.
- The product detail page's image display, for the read-only view.

**UI**
- One new control per image row. The form is already dense, so the picker needs to fit the existing row grid rather than adding a line per image.
- Two component libraries are in play: an antd `Select` inside `Form.Item` for the URL rows, a shadcn `Select` for the pending-upload rows, matching what each file already uses.

**Not in scope**
- No drag-to-reorder for images (`sortOrder` stays derived from array position, as today).
- No bulk "assign all these images to this variant" action.
- No per-variant image galleries in the form — one flat image list with a per-row picker, not a list nested under each variant.
- No change to how the primary image is chosen; an image may be both primary and variant-specific.
