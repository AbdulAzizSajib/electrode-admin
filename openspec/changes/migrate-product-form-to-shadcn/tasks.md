## 1. Dependencies

- [x] 1.1 Add `@radix-ui/react-radio-group` to `package.json` and install with pnpm. Do **not** add `cmdk` (design.md Decision 5) and do **not** remove `antd`.
- [x] 1.2 Confirm the app still builds (`pnpm build`) and the existing tests pass (`pnpm test`) before any source change, so the baseline is known-green.

## 2. UI kit primitives

Built first, consumed by nothing yet. Each gets a test against its `specs/admin-shell/spec.md` scenarios.

- [x] 2.1 Create `src/components/ui/alert.tsx` — `variant: 'default' | 'warning' | 'destructive'`, `title`, optional description as children, `role="alert"`, an icon per severity, and a close control rendered only when `onDismiss` is given (design.md Decision 9).
- [x] 2.2 Test `alert.tsx`: failure message is announced via `role="alert"`; each severity renders its own icon and wording; `onDismiss` fires and no close control appears without it.
- [x] 2.3 Create `src/components/ui/radio-group.tsx` on `@radix-ui/react-radio-group`, styled as a segmented control (the visual `Radio.Group optionType="button"` replaced).
- [x] 2.4 Test `radio-group.tsx`: one tab stop for the whole group; ArrowRight/ArrowLeft move the selection; the group carries the field label and each option its own.
- [x] 2.5 Create `src/components/ui/combobox.tsx` on the existing `Popover` + `Input` — `value`, `onValueChange`, `options`, `placeholder`, `emptyText`, `loading`, `clearable`, `disabled`. Keyboard: ArrowUp/ArrowDown/Home/End move the highlight, Enter selects, Escape closes without changing the selection. ARIA: `role="combobox"` + `aria-expanded` + `aria-controls` on the trigger, `role="listbox"`/`role="option"` on the list, `aria-activedescendant` tracking the highlight.
- [x] 2.6 Test `combobox.tsx`: typing narrows the list; arrow keys + Enter select; Escape leaves the previous selection; "no match" and "still loading" render distinct messages; `clearable` clears back to no selection.
- [x] 2.7 Create `src/components/ui/multi-select.tsx` reusing the combobox list, with selections as removable `Badge` chips and a placeholder when empty.
- [x] 2.8 Test `multi-select.tsx`: three selections render as three chips; removing one leaves the other two; placeholder shows when nothing is selected.

## 3. Leaf components

- [x] 3.1 Convert `src/features/catalog/categories/category-parent-picker.tsx` to use `Combobox` instead of antd `Select`. Keep the `{ value, onChange, tree, excludeId }` contract, the ancestor-chain derivation from `value`, and the "None — stop here" / "No parent (top-level)" options exactly (design.md Decision 7).
- [x] 3.2 **Verify the still-antd consumer**: open `category-form-page` and exercise the parent picker end to end — select a deep parent, save, reopen, confirm the chain rehydrates, and confirm the excluded-subtree rule still hides the category being edited. This page is not migrated and must keep working.
- [x] 3.3 Rebuild `src/components/forms/tag-input.tsx` as a chip input over `Combobox`: keeps `{ value: string[], onChange(string[]) }`, keeps `normalise()` **verbatim**, no client-side re-filtering of server suggestions, Enter and `,` both commit, suggestions exclude keywords already on the product (design.md Decision 8).
- [x] 3.4 Test `tag-input.tsx` against `specs/catalog-management` "Keywords are reused rather than reinvented": an existing keyword is suggested and one already chosen is not; a keyword matching no suggestion is added as typed; "Wireless" added over "wireless" collapses to one, first spelling kept; removing "less" leaves "wireless" intact.

## 4. Media sidebar

- [x] 4.1 Replace antd `Alert` and `Input` in `src/features/catalog/products/components/media-sidebar.tsx` with the kit `Alert` and `Input`. The "Available after saving" gallery notice is `variant="default"`, not dismissible.
- [x] 4.2 Keep the primary-image invariant unchanged: `makePrimary` clears `isPrimary` on every other URL row **and** on every pending upload; adding an image URL marks it primary only when there are no images and no pending uploads.
- [x] 4.3 Keep the object-URL lifecycle for the pending primary preview — created in `useMemo`, revoked in the matching effect cleanup.
- [x] 4.4 Verify in place, while the page is still antd: the sidebar renders, the video upload and poster picker work, the gallery is gated on `productExists`, and starring a URL row clears a pending upload's star.

## 5. Variant editor

- [x] 5.1 Replace antd `Checkbox` with the kit `Checkbox` in `src/features/catalog/products/components/variant-editor.tsx`, including the indeterminate state on the whole-attribute toggle.
- [x] 5.2 Replace antd `Input` / `InputNumber` in the combination table with the kit `Input`, using `type="number"` for offer and regular price. Regular price must stay clearable to *unset* — `onChange` maps `''` to `undefined`, never to `0` (design.md Decision 2).
- [x] 5.3 Replace the antd `Modal` carry-over confirmation with `ConfirmDialog`, keeping "Apply anyway" / "Leave things as they are" and the destructive styling (design.md Decision 10).
- [x] 5.4 Replace the antd `Alert` "No attributes defined yet" with the kit `Alert`, `variant="default"`.
- [x] 5.5 Leave `variant-combinations.ts` and `image-upload-field.tsx` untouched; confirm `variant-combinations.test.ts` still passes.
- [x] 5.6 Test against `specs/catalog-management` "Combinations that cannot be carried over are confirmed before they are lost": adding a value carries existing rows over with code, prices and stock intact; unticking a value with existing combinations opens the confirmation and changes nothing until answered; declining leaves selection and table unchanged; confirming applies and calls `onRowRemoved` for each dropped row.
- [x] 5.7 Test that variant stock renders as read-only text with no editable control (`specs/catalog-management` "Stock is displayed on the authoring page but never set there").

## 6. The product form page

- [x] 6.1 Write the zod schema mirroring the current `FormValues` field for field. Use `z.input`/`z.output` types. Optional numbers (`purchasePrice`, `sellingPrice`) go through the `optionalNumber` preprocess from design.md Decision 2; `offerPrice` stays required; `lowStockThreshold` keeps its default of 5; `isRefundable` / `hasWarranty` are `boolean | null` with `null` meaning "not stated".
- [x] 6.2 Replace `Form.useForm` with `useForm<Values, unknown, OutputValues>({ resolver: zodResolver(schema), values: product ? toValues(product) : undefined, defaultValues: EMPTY_VALUES })`, dropping the `form.setFieldsValue` effect (design.md Decision 3).
- [x] 6.3 **Port the render-phase inventory sync verbatim**, including `syncedProductKey` initialised to `undefined` (never to `productKey`), the `${product.id}:${product.updatedAt}` key, the `uploadsFor` reset, and every explanatory comment. This is the change's highest-risk edit.
- [x] 6.4 Replace `Form.useWatch('offerPrice' | 'sku')` with `form.watch`, feeding `basePrice` and `skuPrefix` to the variant editor.
- [x] 6.5 Replace every `Form.Item` with `FormField` + `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage`. `extra` becomes `FormDescription`; the two label-only, name-less items (the read-only "In stock" row) become a plain `FormItem` with a `FormLabel`. Drop `[&_.ant-form-item]:mb-0!` and the hand-measured `h-[32px]`, replacing them with the kit's own spacing.
- [x] 6.6 Replace the antd field controls: Brand / Tax rule / Bundle deal → `Combobox` (bundle deal `clearable`, sending an explicit `null` when cleared); Collections → `MultiSelect`; Type / Status → the existing kit `Select`; `Switch` → kit `Switch`; `Input`/`InputNumber` → kit `Input`; `TriStateField` → kit `RadioGroup` keeping the `'yes' | 'no' | 'unset'` ↔ `true | false | null` encoding (design.md Decision 6).
- [x] 6.7 Replace `Form.List` for specifications with `useFieldArray`, keeping the column header row that only appears when there is a row, the per-input `aria-label`s, and the required rules on both name and value.
- [x] 6.8 Replace `reportValidationFailure`: use react-hook-form's invalid-submit handler with the same banner wording (one error quotes the field's message plus "it is highlighted below"; more than one gives the count), and add the scroll fallback for the custom controls that cannot be focused — `RichTextEditor`, `CategoryParentPicker`, `TagInput` (design.md Decision 4). Delete the hand-declared `ValidationFailure` interface.
- [x] 6.9 Replace the three antd `Alert`s with the kit `Alert` per design.md Decision 9's mapping: `saveError` destructive + dismissible, `failedLists` warning + not dismissible, load-failure destructive + not dismissible.
- [x] 6.10 Port `handleSubmit` unchanged in substance: the images-on-record guard, `options` / `variants` derivation, `resolveVariantKey` against the exact submitted array, the single-primary promotion covering pending uploads, `bundleDealId ?? null`, and `options`/`variants` sent only when editing.
- [x] 6.11 Port the save-and-navigate semantics: nothing navigates unless the request succeeded; save-and-return goes to `/catalog/products`; a create that stays goes to `/catalog/products/:id/edit` with `replace: true`; a refused save resets nothing.
- [x] 6.12 Keep the loading skeleton and the load-failure early return, and keep the two-column `xl:grid-cols-[minmax(0,1fr)_340px]` layout, the seven cards, their order and their copy.
- [x] 6.13 Confirm `product-form-page.tsx` and its subtree import nothing from `antd`.

## 7. Tests for the page

Written against `specs/catalog-management`, following `resource-form-page-rhf.test.tsx`. The destructive-save guards come first (design.md — Risks).

- [x] 7.1 **Warm-cache gallery regression**: mount the edit route with the product detail already in the `QueryClient`, assert the gallery renders the product's images, and assert a save submits those image rows rather than an empty `images` array.
- [x] 7.2 **Images-on-record guard**: with a product that has images on record and no image rows in the form, assert the save is refused, the message says saving would delete them, and no request is sent.
- [x] 7.3 **Cleared optional price**: clear "Regular price" and save; assert `sellingPrice` is absent from the payload, not `0`. Same for "Purchase price".
- [x] 7.4 **Load failure**: with the detail query failing, assert no fields and no save controls render and a back-to-products control does.
- [x] 7.5 **Validation on a custom control**: submit with Description (a `RichTextEditor`) empty; assert the banner appears and the field is brought into view.
- [x] 7.6 **Refused save keeps values**: make the mutation reject, assert every entered value is still present, the reason is at the top, and the route did not change.
- [x] 7.7 **Reference-list failure**: fail the brands and tax-rules queries, assert the warning names both.
- [x] 7.8 **SKU auto-fill**: typing the name fills the code; editing the code stops it; rebuilding with an empty name warns and leaves the code alone.
- [x] 7.9 **Create-and-continue**: a successful create navigates to the edit route with `replace: true` and the gated sections become available.
- [x] 7.10 **Single primary**: save with images but none starred and assert the first is primary; save with only picked files and none starred and assert a shared file is promoted.

## 8. Verification

- [x] 8.1 `pnpm lint` clean.
- [x] 8.2 `pnpm test` — all suites pass, including the pre-existing `variant-combinations.test.ts`, `resource-form-page.test.tsx` and `resource-form-page-rhf.test.tsx`.
- [x] 8.3 `pnpm build` — `tsc -b` clean.
- [ ] 8.4 Manual pass on `/catalog/products/new`: fill and create, confirm it lands on the edit route with the variants and gallery sections open.
- [ ] 8.5 Manual pass on `/catalog/products/:id/edit` for a product with variants and images: change a price, add a specification, tick a new attribute value, upload an image, save, reload, confirm everything persisted.
- [ ] 8.6 Manual pass on `/catalog/categories/:id/edit` — the still-antd page whose parent picker this change touched.
- [x] 8.7 Confirm no page outside this change's file list was modified, and that `antd` is still in `package.json` with `ConfigProvider` still wrapping the app in `main.tsx`.

## 9. Optional — needs the user's go-ahead

- [ ] 9.1 Delete `src/features/catalog/products/product-form-page-copy.tsx`. It is a byte-identical, unrouted, unimported duplicate of the page; after this change it would be the only antd product form left in the tree. Left in place is also safe. Do not do this without asking.
