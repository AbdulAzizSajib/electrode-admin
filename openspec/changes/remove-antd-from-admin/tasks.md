## 1. Phase 1 — Kit primitives

Built and tested before anything consumes them, so nothing can regress in this phase. See design.md Decisions 3, 4 and 5.

- [x] 1.1 Confirm the baseline is green before any source change: `pnpm -C admin lint`, `pnpm -C admin test`, `pnpm -C admin build`. Record which tests pass so a later failure is attributable.
- [x] 1.2 Create `src/components/ui/number-input.tsx` — a `type="number"` field over the kit `Input` with `min`, `max`, `step` and `suffix` props. It spreads the react-hook-form `field` and overrides `value` only, rendering `''` for `undefined` or `null`; `onChange` stays RHF's default. `suffix` renders inline after the field (antd's `addonAfter`, used for the tax rule's `%`). See design.md Decision 4 — empty-vs-zero is a schema concern, not a component one.
- [x] 1.3 Create `src/lib/validation/numeric.ts` exporting `optionalNumber(message?)` and `requiredNumber(message?)`, lifted verbatim from `product-form-page.tsx`'s local `optionalNumber`, so the twelve migrated pages share one rule. Test both against `specs/admin-shell` "Numeric fields accept an empty value distinctly from zero": `''` parses to `undefined`, `'0'` parses to `0`, the two are distinguishable, and a negative value is refused with the given message.
- [x] 1.4 Create `src/components/ui/color-input.tsx` — a native `<input type="color">` paired with a hex text input. Holds `string | undefined`. Typing a valid hex updates the swatch; picking a colour updates the text. An untouched field reports `undefined`, not `#000000` (design.md Decision 5).
- [x] 1.5 Test `color-input.tsx` against `specs/admin-shell` "Colour values are entered and shown as a hex code": picking sets the hex, typing a hex sets the swatch, and a never-set field stays unset through a save.
- [x] 1.6 Add `FormArrayMessage({ name })` to `src/components/ui/form.tsx` — reads `formState.errors` at `<name>.root` and renders it with `FormMessage`'s styling. This is what makes an array-level zod issue visible; without it a group rule refuses the save with nothing on screen (design.md Decision 3).
- [x] 1.7 Test `FormArrayMessage`: a `superRefine` issue raised on an array path renders at the group's position; no message renders when the array is valid; a field-level error inside a row still renders through the row's own `FormMessage` and is not swallowed.
- [x] 1.8 Retrofit `src/features/catalog/products/product-form-page.tsx`: the four inline numeric bindings become `NumberInput` (preserving `min`, `step` and `className` at each site), and its local `optionalNumber` helper is replaced by the import from `lib/validation/numeric`. That page's existing tests must stay green (design.md Decision 4).
- [x] 1.9 Run lint, test and build. Phase 1 is shippable on its own.

## 2. Phase 2 — Plain pages

Five pages with no conditional and no repeating fields. Each: add a zod schema, a `useForm`, and swap `ResourceFormPage` for `ResourceFormPageRhf`, following `supplier-form-page` (design.md Decision 2). Field order, labels, help text and validation wording are copied verbatim — antd `Form.Item extra` becomes `FormDescription`.

- [x] 2.1 Migrate `src/features/catalog/brands/brand-form-page.tsx` (antd `Input`, `Switch`).
- [x] 2.2 Migrate `src/features/catalog/collections/collection-form-page.tsx` (antd `Input`, `Switch`).
- [x] 2.3 Migrate `src/features/ui/fonts/font-form-page.tsx` (antd `Input`).
- [x] 2.4 Migrate `src/features/catalog/categories/category-form-page.tsx` (antd `Input`, `InputNumber`, `Switch`). It already consumes the shadcn `category-parent-picker`; keep that wiring and use `NumberInput` for the numeric field.
- [x] 2.5 Migrate `src/features/catalog/brands/brand-bulk-create-page.tsx` (antd `Alert`, `Input`). Replace `form.setFieldsValue({ namesText: '' })` with `form.setValue('namesText', '')` and the antd `Alert` with the kit `Alert`.
- [ ] 2.6 Verify each of the five in the running app: create one record, reopen it for edit, confirm the loaded values appear, change one field, save, reload and confirm it persisted.
- [ ] 2.7 Verify the refused-save guarantee on one of the five: force a server refusal and confirm every entered value stays on the page with the reason above the fields.
- [x] 2.8 Run lint, test and build.

## 3. Phase 3 — Conditional and slug pages

Five pages that make one field depend on another. Every `shouldUpdate` + `getFieldValue` pair and every `Form.useWatch` becomes `useWatch({ control, name })` (design.md Decision 6).

- [x] 3.1 Migrate `src/features/catalog/tax-rules/tax-rule-form-page.tsx`. The value field's label ("Percentage" / "Amount"), its `max` bound, its help text and its `%` suffix all follow `type` — drive them from `useWatch` on `type` and express the conditional bound in the zod schema, keeping both messages ("A percentage is between 0 and 100", "An amount cannot be negative") word for word.
- [x] 3.2 Migrate `src/features/catalog/bundle-deals/bundle-deal-form-page.tsx`. Its `shouldUpdate` reads `buyQuantity` and `freeQuantity` together; use one `useWatch` over both names.
- [x] 3.3 Migrate `src/features/ui/pages/page-form-page.tsx`. The child taking `FormInstance` takes `UseFormReturn` instead; `form.setFieldValue('slug', slugify(…))` becomes `form.setValue('slug', slugify(…))`.
- [x] 3.4 Migrate `src/features/ui/blog/blog-form-page.tsx` — same slug handoff as 3.3, plus its `Select` fields.
- [x] 3.5 Migrate `src/features/ui/testimonials/testimonial-form-page.tsx`. It watches `photoUrl` and `authorName` and clears `photoUrl` from a button; convert both watches to `useWatch` and both writes to `setValue`. Use `NumberInput` for the rating field. **Deviation:** `NumberInput` went to `sortOrder` ("Order"), the page's only `InputNumber`. Rating is an antd `Select` of the five whole stars, and turning a curated 1–5 picker into a free number box is a redesign the proposal rules out ("Layouts, card grouping, field order and copy stay as they are"), so it became the kit `Select` instead. Reverse this if the literal reading was intended.
- [x] 3.6 Verify slug auto-fill still stops the moment the merchant edits the slug themselves, on both `page` and `blog`: type a title, watch the slug follow, edit the slug, type more title, confirm the slug no longer follows.
- [x] 3.7 Verify the tax rule's conditional behaviour: switch type to percentage, confirm the label, bound and suffix change without a save, and that entering 150 is refused with the percentage message.
- [x] 3.8 Run lint, test and build.

## 4. Phase 4 — Repeatable list pages

Where the risk is. `Form.List` becomes `useFieldArray`; list-level `rules` become `superRefine` on the array, surfaced with `FormArrayMessage` (design.md Decision 3).

- [x] 4.1 Migrate `src/features/catalog/attributes/attribute-form-page.tsx` — the values list to `useFieldArray` with `append`, `remove` and `move`; antd `Button` to the kit `Button`; antd `Alert` to the kit `Alert`; `ColorPicker` to `ColorInput`.
- [x] 4.2 Express the attribute's two group rules in the schema: at least one value with a non-blank label, and no two labels equal once trimmed and lowercased. Both messages copied verbatim — "An attribute needs at least one value", "Two values read as the same choice" — and both rendered through `FormArrayMessage`.
- [x] 4.3 Keep the swatch column gated on `presentation === 'SWATCH'` via `useWatch`, and keep blank-labelled rows filtered out of the payload at save.
- [x] 4.4 Keep the 409 force-removal flow exactly as it is: the `ApiError` 409 is caught, swallowed rather than surfaced as a plain error, the pending values are held, and confirming re-sends them with `force` so nothing is re-entered.
- [x] 4.5 Test `attribute-form-page` against `specs/catalog-management`: order survives a save; a blank row is discarded; "Red" twice is refused; "Red" and "red" are refused; removing every value is refused with the message against the list; switching presentation shows the colour controls without a save; a 409 offers "remove them anyway" and confirming re-sends without re-entry.
- [x] 4.6 Migrate `src/features/ui/landing-pages/landing-page-lists.tsx` one list at a time — `media`, `highlights`, `faqs`, `quotes`, `trustBadges`, `deliveryZones` — each to `useFieldArray`, keeping its own add / remove / reorder controls and the shared `RowActions` (antd `Button` to the kit `Button`).
- [x] 4.7 In `MediaListField`, move the per-row `shouldUpdate` on `media[i].type` into the row component as `useWatch({ control, name: \`media.${index}.type\` })`, so switching one row between image and video re-renders that row only.
- [x] 4.8 In `DeliveryZonesField`, keep the `MAX_DELIVERY_ZONES` ceiling on the add control, keep the last row's removal control unavailable, keep the `ZONE_KEY_PATTERN` field rule, and move the distinct-key rule to `superRefine` rendered through `FormArrayMessage`.
- [x] 4.9 Migrate `src/features/ui/landing-pages/landing-page-form-page.tsx` (antd `Input`, `InputNumber`, `Select`, `Switch`, `FormInstance`) — slug handoff as in phase 3, `useWatch` for `productId`, `NumberInput` for its numeric fields.
- [x] 4.10 Test the landing page's group rules against `specs/admin-shell`: two zones sharing a key are refused with the message against the group and both rows keep their values; the add control disables at `MAX_DELIVERY_ZONES`; the sole remaining zone offers no remove control; reordering a media row keeps both rows' values and submits in the shown order.
- [ ] 4.11 Verify a full landing page end to end in the app: build one with several media rows, highlights, FAQs and two delivery zones, save, reload, and confirm order and every value round-tripped.
- [x] 4.12 Run lint, test and build.

## 5. Phase 5 — Teardown

No page uses antd after phase 4. This removes what is left and proves it.

- [x] 5.1 Replace the two antd `Alert` usages in `src/components/crud/resource-form-layout.tsx` with the kit `Alert` — the load-failure alert (not dismissible) and the save-failure alert (dismissible, `onDismissError`). Keep both in their current positions.
- [x] 5.2 Rewrite `category-parent-picker.test.tsx`'s harness: replace the antd `Form` wrapper with a `useState`-controlled harness supplying `value`/`onChange`. Assertions unchanged (design.md Decision 8).
- [x] 5.3 Delete `src/features/catalog/products/product-form-page-copy.tsx`. Confirm first that nothing imports it and no route lazy-loads it. This also closes task 9.1 of `migrate-product-form-to-shadcn`.
- [x] 5.4 Delete `src/components/crud/resource-form-page.tsx` and `resource-form-page.test.tsx`. Confirm no imports remain.
- [x] 5.5 Remove `ConfigProvider` and `buildAntdTheme` from `src/features/ui/fonts/admin-font-provider.tsx`, keeping the `--font-sans` assignment and the injected stylesheet `<link>` exactly as they are. Rewrite its header comment to describe the one remaining mechanism instead of two.
- [x] 5.6 Delete `src/lib/antd-theme.ts`. Confirm against `src/index.css` that `--color-primary`, `--color-destructive`, `--color-success`, `--color-warning` and `--radius-md` still carry the five values it mirrored (design.md Decision 10).
- [x] 5.7 Rename `ResourceFormPageRhf` to `ResourceFormPage` and `resource-form-page-rhf.tsx` to `resource-form-page.tsx`, updating all 18 callers and the test file. Mechanical, one commit (design.md Decision 1).
- [x] 5.8 Rewrite the header comments in the renamed scaffold and in `resource-form-layout.tsx` that describe the panel as having two form stacks migrating toward antd. Both statements are now false.
- [x] 5.9 Remove `antd` from `admin/package.json` and run `pnpm install`. Confirm `pnpm -C admin build` passes — a surviving import fails `tsc -b` here, which is the completion check (design.md Decision 9).
- [x] 5.10 Confirm `antd` appears nowhere under `admin/` outside `openspec/`.
- [x] 5.11 Correct `admin/CLAUDE.md` — **no such file; the claims live in the root `CLAUDE.md`, which is what was corrected**: the two form scaffolds are now one, `resource-form-page-rhf.tsx` no longer exists, and antd is no longer the migration target or a dependency.
- [ ] 5.12 Run lint, test and build. Full manual pass over one page from each phase. **lint / test / build are green** (286 tests, 30 files; the one lint error is pre-existing in `lib/realtime/use-order-alert.ts`, from `add-realtime-dashboard-updates`). The manual pass is outstanding, alongside 2.6, 2.7 and 4.11.
