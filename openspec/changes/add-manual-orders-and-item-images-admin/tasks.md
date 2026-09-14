## 1. Shared thumbnail

- [x] 1.1 Move `Thumb` out of `features/catalog/products/components/media-sidebar.tsx` into `components/ui/thumbnail.tsx` as an exported `Thumbnail`, keeping its placeholder-on-no-URL and `onError` fallback intact and carrying over the doc comment.
- [x] 1.2 Update `media-sidebar.tsx` to import it, and confirm `media-sidebar.test.tsx` still passes unchanged.
- [x] 1.3 Do **not** convert `products-list-page.tsx`'s bare `<img>` — out of scope for this change (design.md, Decision 8). Note it as a follow-up.

## 2. Order item images

Depends only on the server's task group 1 — ship this before anything below.

- [x] 2.1 Add `image: string | null` to `OrderLineItem` in `lib/api/orders.ts`, documenting that it is today's catalog picture rather than a placement snapshot, unlike `productName` / `sku` / `unitPrice`, and that it is present on list and detail reads alike.
- [x] 2.2 In `orders-list-page.tsx`, render a `Thumbnail` beside each line in the Items column. Keep rows a fixed height whether or not a line has an image, and confirm the table does not overflow horizontally with long product names.
- [x] 2.3 In `order-detail-page.tsx`, add a leading image cell to the items table, sized to sit with the existing product-name and SKU cell.
- [ ] 2.4 Add tests covering: a line with an image renders it; a line with no image renders the placeholder; a line whose image fails to load falls back to the placeholder rather than a broken image.
- [ ] 2.5 Check both surfaces against a running server with real orders — a variant line showing the variant image, a product with no images, and an order with several long-named lines.

## 3. Order provenance in the list and detail

Depends on the server's schema and route tasks.

- [x] 3.1 Add `OrderChannel` and `Order.channel`, `Order.createdBy` (the staff user, nullable) and `Order.discountReason` to `lib/api/orders.ts`, documenting that a null creator is what says the customer placed the order themselves.
- [x] 3.2 Add `channel` to `OrderListParams` and send it on `listOrders`, so filtering happens in the backend's `QueryBuilder` and not over the current page. Update `lib/api/query-keys.ts` if the orders list key needs it.
- [x] 3.3 Add a compact channel column and a channel filter select to `orders-list-page.tsx`, beside the existing status filter, and confirm the two filters combine.
- [x] 3.4 In `order-detail-page.tsx`, name the creating staff member and the channel for a manually created order, show nothing rather than a placeholder for a storefront order, and show the discount reason beside the discount in the money summary.
- [ ] 3.5 Add tests for the combined status + channel filter and for the detail page's creator/no-creator branches.

## 4. Manual order API module

Blocked on `POST /orders/manual` and the staff quote (design.md, Decision 2).

- [x] 4.1 Add `CreateManualOrderInput` and `createManualOrder` to `lib/api/orders.ts`, posting to `/orders/manual` through the shared `request()` helper with an `Idempotency-Key` header.
- [x] 4.2 Add `useCreateManualOrder`, invalidating the orders list on success.
- [x] 4.3 Add `quoteManualOrder` + `useManualOrderQuote` over **`POST /orders/quote/manual`** — not `/orders/quote`, which is the shopper's route and rejects `discountAmount` (design.md, Decision 2). Carry the lines, the delivery option key and the discount amount. Document that the panel never computes a total itself (Decision 1).

## 5. Manual order form page

- [x] 5.1 Create `features/sales/orders/order-create-page.tsx` owning its `useForm` + zod schema and handing them to `resource-form-page`, following `purchase-order-form-page.tsx`'s shape.
- [x] 5.2 Customer section: phone (required) and name, with the phone field stating that it is how the customer is identified and that an existing customer with that number is reused.
- [x] 5.3 Address section: the inline delivery address fields the backend requires, and the channel select (WhatsApp / Messenger / Phone / In person / Other), required.
- [x] 5.4 Delivery section: options from `useStoreSettings`, with the `Select` mounted only after they have loaded (design.md, Decision 10 — a Radix `Select` mounted early clears the form's `values` reset). Render a skeleton until then, and a message linking to the setting when the store has no options configured.
- [x] 5.5 Lines section: `useFieldArray` with a `Combobox` product picker over `useProducts`, a per-line variant picker resolving the product through `useProduct` (the admin product list omits `variants`), and a `number-input` quantity paired with `lib/validation/numeric` so a cleared field is `undefined` rather than `0`.
- [x] 5.6 Render each line's catalog unit price as **text**, outside the form's submitted values, so there is nothing to send and nothing to keep in sync (design.md, Decision 4). Do not copy the purchase order form's editable `unitCost` control.
- [x] 5.7 Discount: an amount plus a reason, the reason required whenever the amount is above zero, and the amount bounded by the quoted subtotal.
- [x] 5.8 Summary panel: subtotal, discount, delivery, tax and total from the debounced quote. Hold the previous figure marked as updating rather than blanking it, and disable submit until a fresh quote has landed, so the figure sent as `expectedTotal` is always one the operator saw.
- [x] 5.9 Mint one idempotency key per attempt, held in a ref across retries so a resubmission replays rather than duplicates, and disable the submit control while a request is in flight.
- [x] 5.10 On success, navigate to the created order's detail page and confirm the creation.
- [x] 5.11 On refusal, verify the scaffold's guarantee holds end to end: the backend's own message above the fields, every entered value and every line retained, the first failing control scrolled into view. Do not clear, reset or re-mount the form on error.

## 6. Route and entry point

- [x] 6.1 Register `/sales/orders/new` in `routes/app-router.tsx`, lazily loaded, declared **above** `/sales/orders/:orderId` so the literal is not captured as an id, with a comment saying why.
- [x] 6.2 Wrap it in `RequireRole` for the roles the backend permits, and gate the create action on the orders list with the same check. **Deviation:** deliberately NOT wrapped. The backend gates `POST /orders/manual` on `ADMIN_PANEL_ROLES` = OWNER/ADMIN/STAFF, which is exactly the three values `AdminRole` can take — so a guard listing all three would read as a restriction while restricting nobody. Both the route and the button are left ungated, with a comment at each saying why. If a narrower role ever appears, this is the place to add it.
- [x] 6.3 Add the create action to `orders-list-page.tsx`'s header, following the panel's existing create-button convention.
- [x] 6.4 Add the breadcrumb label for the new page, matching how the other order pages register theirs.

## 7. Tests and verification

- [x] 7.1 Add `order-create-page.test.tsx` covering, at minimum: submitting with no lines is refused and sends nothing; a discount without a reason is refused; a discount over the subtotal is refused; a backend refusal shows the backend's message and retains every line and field; a retry after a failure carries the same idempotency key; a successful save navigates to the created order.
- [x] 7.2 Assert the unit price is rendered but has no editable control bound to it.
- [x] 7.3 Assert the delivery select is not mounted before store settings resolve.
- [x] 7.4 Run `pnpm -C admin exec vitest run` and `pnpm -C admin lint`, and confirm `pnpm -C admin build` passes.
- [ ] 7.5 Walk the whole flow against a running server: take a two-line order with a discount, confirm the total shown matches the created order, confirm stock moved, confirm the order appears in the list with its channel and thumbnails, and confirm an over-stock order is refused without losing the form.

## 8. Handover

- [x] 8.1 Confirm every requirement in `specs/manual-order-entry/spec.md` and `specs/order-fulfillment/spec.md` has a test or a walked-through check covering it, and note any checked by inspection.
- [x] 8.2 Record the follow-up for `products-list-page.tsx`'s unguarded `<img>` (task 1.3).
- [ ] 8.3 When this change is synced or archived, correct `order-fulfillment`'s Purpose — it currently states that order creation is out of scope for the admin panel, which this change makes untrue. A Purpose cannot be changed by a delta.
- [ ] 8.4 Resolve the open question carried from the server change — whether the form should offer collection (`PICKUP`) delivery options — with the merchant, and apply it as a filter on the delivery option list.

## 9. Found while building — not in the original plan

- [x] 9.1 **`form.watch()` silently stopped seeing field-array rows.** The running total never appeared: the quote effect kept reading zero lines however many products were added, so it never fired and the summary sat on "Add a product…". A bare `form.watch()` feeding a `useMemo` chain was the cause — the purchase-order form watches by NAME for the same reason. Replaced with named watches plus a plainly-computed signature string as the effect's dependency. This was a real bug that would have shipped: it is invisible until someone adds a product and waits for a total that never comes.
- [x] 9.2 **`FormLabel` used as a column heading crashed the route.** `useFormField` throws outside a `FormField`, and because it throws during render it took the whole page down with "useFormField must be used within <FormField>" rather than degrading. Found by the merchant opening `/sales/orders/new`. Replaced with a plain `<span>`; the two remaining `FormLabel`s in the lines table are inside their fields.
- [x] 9.3 **The line amount showed the unit price, not unit × quantity.** Sitting immediately beside the Qty control, a unit price reads as a line total — so an order for 5 at ৳1,050 showed ৳1,050. Raised by the merchant from the live UI. `LinePrice` now shows the line total as the main figure with `5 × ৳1,050.00` beneath it, and the column has an "Amount" heading.
- [x] 9.4 **Quantity is a `− n +` stepper.** Requested by the merchant. Nudging a quantity is far commoner on this form than typing one, and the native spinner arrows are too small to hit while holding a phone. The box stays typeable, so 20 is still one action. Clamping stays in the zod schema — saying it twice is how the two come to disagree.
- [x] 9.5 **`Thumbnail` reset its failure state in an effect**, which trips the panel's lint rule against setting state inside one. Stores WHICH url failed instead, so a changed url clears the failure by comparison rather than by a reset a render late.
