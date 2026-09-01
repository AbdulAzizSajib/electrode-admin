## 1. API types

- [ ] 1.1 Add `variantId?: string | null` to the `ProductImage` response type in `src/lib/api/products.ts`.
- [ ] 1.2 Add `variantId?: string` and `variantIndex?: number` to `ImageSlotInput` and to the image entries accepted by `ProductInput`, documenting that `variantId` wins when both are present and that absence means shared.
- [ ] 1.3 Confirm `buildProductForm` needs no change — both new fields ride inside the existing `data` JSON blob (design Decision 7).

## 2. Variant identity in the form

- [ ] 2.1 Give each variant row a stable local key that survives reordering and deletion of other rows, so an assignment can point at an unsaved variant without using the array index (design Decision 1). For saved variants the key is the backend `id`.
- [ ] 2.2 Derive the picker's option list from `Form.useWatch('variants', form)`, labeled by each variant's `name` and filtered to variants that have a non-empty one (design Decision 5). Include a "Shared — all variants" sentinel as the default.
- [ ] 2.3 Handle the empty case: when the product is variable but no variant has a name yet, the control reports there is nothing to choose rather than rendering an empty list.

## 3. The picker in both image inputs

- [ ] 3.1 Add a `variantKey` field to the form-local `ImageValue` type and an antd `Select` inside a `Form.Item` to each row of the `images` `Form.List`, shown only when `type === 'VARIABLE'`.
- [ ] 3.2 Add the same reference to `PendingImage` in `image-upload-field.tsx` and a shadcn `Select` to each pending row, driven by the existing `onChange` callback (design Decision 3). Pass the option list and the product type into the component.
- [ ] 3.3 Fit the picker into the existing row grids rather than adding a line per image; check the layout at the form's minimum supported width.
- [ ] 3.4 Add a short note near the image section explaining that shared images appear for every variant, so the default is understood rather than guessed at.

## 4. Submit

- [ ] 4.1 Write one helper that resolves a `variantKey` to `{ variantId }` for a saved variant, `{ variantIndex }` for a variant being created in this submission, or neither for shared — resolving the index against the same `variants` array being submitted (design Decision 1).
- [ ] 4.2 Apply it in the submit mapper for both the URL `images` entries and the `imageSlots` entries, so create and edit share one code path.
- [ ] 4.3 Confirm the `variants` array used for index resolution is the exact array submitted in the same request, built in the same pass — not a separately-derived list.

## 5. Load, delete, and display

- [ ] 5.1 In the edit-mode load effect, map each saved image's `variantId` to the matching variant's key so the picker shows the saved assignment as its current selection.
- [ ] 5.2 On variant row delete, clear `variantKey` on any image row and any pending image that named it, so the form never submits a reference to a variant not in the payload (design Decision 4).
- [ ] 5.3 Add a read-only assignment label to each image on the product detail page — the variant's name, or "Shared".

## 6. Verification

- [ ] 6.1 Against the deployed API with `link-product-images-to-variants` applied: create a variable product with two variants and images assigned to each plus one shared, and confirm the saved product returns the assignments the form submitted.
- [ ] 6.2 Reopen that product for editing, change nothing, save; confirm every assignment is unchanged — this is the round trip most likely to silently clear assignments.
- [ ] 6.3 Add a new variant during an edit and assign an existing image to it in the same save; confirm both the variant and the assignment are applied in one request.
- [ ] 6.4 Change an assigned image back to shared and save; confirm the assignment is cleared rather than retained.
- [ ] 6.5 Delete a variant that images were assigned to; confirm those rows fall back to Shared in the form and the save succeeds.
- [ ] 6.6 Stage a file for upload, assign it to a variant, and save; confirm on create (index path) and on edit (id path) that the uploaded image lands on the right variant.
- [ ] 6.7 Confirm a simple product shows no picker anywhere, and that creating and editing simple products is unchanged.
- [ ] 6.8 Confirm a variable product saved with no assignments at all behaves exactly as before this change.
- [ ] 6.9 Force a backend rejection (submit an assignment the API refuses) and confirm the form stays open with the admin's input intact and the error shown.
