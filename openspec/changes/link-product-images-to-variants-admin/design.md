## Context

See proposal.md for motivation. Four properties of the existing product form determine the shape of this change:

- **The form is Ant Design, not react-hook-form.** `product-form-page.tsx` uses `Form.useForm()` and `Form.List`, with antd's declarative `rules` for validation. `react-hook-form` and `zod` are in `package.json` and `components/ui/form.tsx` is a shadcn RHF wrapper, but neither is used here. New form-bound controls follow the antd convention.
- **Images arrive through two independent inputs.** URL rows live in a `Form.List name="images"` inside the antd form; staged files live in React state (`pendingImages`) outside it, rendered by `ImageUploadField` with shadcn primitives. They already coordinate manually for `isPrimary` — `setPrimaryUrlRow` clears pending primaries and the upload field's `onChange` clears URL-row primaries. Variant assignment needs the same treatment in both, and unlike `isPrimary` it needs no cross-list coordination, because assignments are independent per image.
- **`sortOrder` is derived from array index at submit time**, not stored per row. Assignment is the first per-image property that is genuinely authored rather than derived, and it must survive the round trip through edit mode.
- **The API reconciles nested collections by id**: rows with an `id` are updated, rows without are created, and rows absent from the payload are deleted. The edit-mode load already preserves each image's and variant's `id` for this reason. Assignment must ride along the same round trip or resubmitting an untouched product would silently clear every assignment.

The backend contract this builds against is defined by the `electrode-server` change `link-product-images-to-variants`: an image carries `variantId` (an existing variant) or `variantIndex` (a position in the same request's `variants` array), with `variantId` winning if both are present, and absence meaning shared.

## Goals / Non-Goals

**Goals:**
- One control per image row that reads as an ordinary form field, in a form that is already dense.
- Assignment survives the full round trip: load a saved product, change nothing, save, and every assignment is exactly as it was.
- Create and edit use one code path for building the payload, so the id-versus-position distinction is resolved in one place rather than at every call site.

**Non-Goals:**
- Not restructuring the form into per-variant image groups (see Decision 2).
- Not migrating the product form to react-hook-form, and not unifying the two image inputs into one component. Both are pre-existing conditions this change works within.
- No bulk assignment action, no drag-to-reorder.

## Decisions

**1. One `variantKey` field per image row, resolved to `variantId` or `variantIndex` at submit time.** The picker writes a single form value identifying the chosen variant; the submit mapper turns it into whichever field the API expects. Making the form hold two mutually-exclusive fields would push an API transport detail into every row's state and into the edit-mode load, and would make "assigned to the variant currently in position 2" and "assigned to variant `abc`" two states the UI has to keep consistent. One value, resolved once, at the boundary.
- The key is the variant's backend `id` when it has one, and a stable local key when it does not. Variants added in the form need an identifier before the server gives them one, and the array index cannot serve — deleting an earlier variant row shifts it, silently repointing every assignment below it.
- *Alternative considered*: store the array index directly and fix it up on delete. Rejected — every variant mutation becomes a reindexing pass over the image list, and any missed path corrupts assignments invisibly.

**2. A flat image list with a per-row picker, not images nested under each variant.** Nesting would model the relationship more literally, but shared images (`variantId: null`) have no variant to nest under and would need a separate top-level section, splitting one concept across two places in the form. It would also mean rebuilding both image inputs and the `sortOrder`-from-index rule, which is a much larger change than the association warrants. A per-row picker keeps every image in one list where `sortOrder`, `isPrimary` and assignment are all row properties.

**3. The picker matches each file's existing library: antd `Select` in a `Form.Item` for URL rows, shadcn `Select` for pending-upload rows.** The two image inputs already differ this way — `ImageUploadField` is deliberately outside the antd form and uses shadcn `Input`/`Checkbox` throughout, with a doc comment explaining the separation. Introducing antd into it, or shadcn into the antd `Form.List`, would mix conventions inside a single file for no gain. The two pickers share their option list and their "shared" sentinel, not their rendering.

**4. Deleting a variant clears assignments pointing at it, in the form, before submit.** The API's own behavior is to preserve images of a removed variant as shared, so an unclered reference is not destructive — but it would submit a `variantKey` naming a variant no longer in the payload, which is a 400. Clearing on delete makes the form state always submittable and makes the outcome visible: the admin sees those rows fall back to "Shared" at the moment they delete the variant, rather than discovering it after a failed save.

**5. The picker's options come from the live variants field, labeled by `name`, filtered to variants that have one.** `Form.useWatch('variants', form)` already drives the conditional variants section, so the picker re-renders as variants are added, renamed, or removed with no extra wiring. A variant with an empty `name` cannot be meaningfully labeled, so it is excluded and the picker reports that there is nothing to choose — rather than rendering a blank option an admin could select without knowing what they picked.

**6. Assignment is loaded back into the form from the saved product's `variantId`, mapped to the corresponding variant's key.** The existing edit-mode `useEffect` already maps `product.images` and `product.variants` into form values preserving ids; assignment mapping joins it there. Because saved variants' keys *are* their ids, this is a direct copy — the index path only ever applies to variants created in the current editing session.

**7. `buildProductForm`'s multipart shape is unchanged.** The new fields ride inside the existing `data` JSON blob for URL images and inside `imageSlots[i]` for staged files, both of which are already serialized into `data`. No new multipart field, no change to how files are appended.

## Risks / Trade-offs

- **[Risk]** Shipping before the API change means `variantId`/`variantIndex` are stripped by the server's zod validation and assignments are silently discarded — the admin sees a successful save that did nothing → **Mitigation**: this change is explicitly gated on `link-product-images-to-variants` landing first (proposal, Depends on). Verification task 6.1 checks a real round trip against the deployed API rather than trusting the form's own state.
- **[Risk]** An admin assigns every image to a variant, leaving no shared images, so a variant with no images of its own has an empty gallery on the storefront → **Mitigation**: not enforced here; the storefront change specifies falling back to the full image set rather than rendering empty. Worth a hint in the form's help text but not a validation rule, since "every image is variant-specific" is legitimate for a product photographed per color.
- **[Risk]** The image row grid is already dense; adding a select can push it to wrap awkwardly at narrow widths → **Mitigation**: the picker replaces row space rather than adding a line — verify at the form's minimum supported width during implementation and adjust the grid template rather than stacking.
- **[Risk]** An image marked primary that is also variant-specific makes the product card thumbnail show one variant while the card price is the product default → **Mitigation**: allowed deliberately (it is a real merchandising choice); surfaced as a note in the form rather than blocked.

## Migration Plan

1. Extend the API types in `src/lib/api/products.ts` — `ProductImage.variantId`, and the assignment fields on `ImageSlotInput` and the image entries of `ProductInput`.
2. Add a stable local key to variant rows in the form so assignments can point at unsaved variants (Decision 1), and derive the picker's option list from the watched `variants` field (Decision 5).
3. Add the picker to the URL image rows (antd) and to `ImageUploadField` (shadcn).
4. Resolve `variantKey` to `variantId`/`variantIndex` in the submit mapper, for both `images` and `imageSlots`, in one shared helper.
5. Map saved `variantId` back into `variantKey` in the edit-mode load; clear assignments on variant delete.
6. Add the read-only assignment label to the product detail view.

**Rollback**: the form's own state is additive and the API treats a missing assignment as shared, so reverting this change leaves saved assignments in the database untouched and simply stops offering the control. No data cleanup required.
