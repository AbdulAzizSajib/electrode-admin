## 1. Orders (`src/lib/api/orders.ts`)

- [x] 1.1 Reshape `Order`: `status: 'PENDING'|'CONFIRMED'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CANCELLED'|'COMPLETED'` (was `fulfillmentStatus`, 5 values); remove `paymentStatus` entirely; `subtotal`/`discountAmount`/`shippingAmount`/`taxAmount`/`totalAmount` (Decimal-as-string); `customer: {id, firstName, lastName, email, phone}` embedded (drop hand-joined `customerName`/`customerEmail`); `shippingAddress: CustomerAddress | null` (new shape: `addressLine1`/`addressLine2`, required `phone`, optional `state`/`postalCode`); `statusHistory: {fromStatus, toStatus, note, changedById, createdAt}[]`; items add `variantId`, `unitPrice`/`totalPrice` become Decimal-as-string.
- [x] 1.2 Implement `listOrders` against `GET /orders` (`searchTerm`, `status`, `page`, `limit` — no customer-name search, no date range, no `customerId` filter; none of those are in the real endpoint's `filterableFields`/`searchableFields`), `getOrder` against `GET /orders/:id`.
- [x] 1.3 Implement `updateOrderStatus` against `PATCH /orders/:id/status` (`{status, note?}`) — no forward-sequence validation client-side (design.md Decision 1). Drop `cancelOrder`/`useCancelOrder` (the dedicated cancel endpoint is customer-only, design.md Decision 2) — the detail page's cancel action calls `updateOrderStatus` with `status: 'CANCELLED'` instead (task 3.2).
- [x] 1.4 Drop `createOrder`/any create mutation entirely — no backend capability for it, and the mock never exposed a create UI either.
- [x] 1.5 Keep `_getAllOrders()`/`_getOrderById()` exported as a lazily-populated async cache (same shape as `_getAllProducts()`); drop `_setOrderPaymentStatus`/`_advanceOrderToShipped`/`_isShippingMethodReferenced` outright (no consumers outside this change's files).

## 2. Shipping methods, payments, shipments

- [x] 2.1 Reshape `ShippingMethod`/`ShippingMethodInput`: `description` optional, add `estimatedDays?`, `price` Decimal-as-string on read. Implement against `POST /shipping-methods`, `GET /shipping-methods/admin`, `GET /shipping-methods/admin/:id`, `PATCH/DELETE /shipping-methods/:id`. Drop `_getAllShippingMethods()` (no consumers outside `orders.ts`, itself migrated).
- [x] 2.2 Reshape `Payment`: `method: 'COD'|'CARD'|'BKASH'|'NAGAD'|'ROCKET'|'STRIPE'|'PAYPAL'|'BANK_TRANSFER'|'OTHER'`; `status: 'PENDING'|'PROCESSING'|'PAID'|'FAILED'|'CANCELLED'|'REFUNDED'|'PARTIALLY_REFUNDED'`; `amount` Decimal-as-string on read; add `transactionId?`, `gateway?`, `paidAt?`. Implement `listPaymentsByOrder` against `GET /orders/:id/payments`, `recordPayment` against `POST /orders/:id/payments` (`{amount, method, status}` — amount stays required client-side per design.md Decision 3).
- [x] 2.3 Reshape `Shipment`: `status: 'PENDING'|'PROCESSING'|'SHIPPED'|'IN_TRANSIT'|'OUT_FOR_DELIVERY'|'DELIVERED'|'FAILED'|'RETURNED'`; `shippingMethodId?`, embedded `shippingMethod` object; `shippedAt?`/`deliveredAt?`. Implement `getShipmentByOrder` against `GET /orders/:id/shipment` (treat 404 as "no shipment yet", not an error to surface), and an `upsertShipment` that calls `POST` when none is loaded yet and `PATCH` when one is (design.md Decision 5).

## 3. Orders pages

- [x] 3.1 Update `orders-list-page.tsx`: drop the Payment column (no per-row payment data available, design.md Non-Goals); status label/variant maps cover all 7 values; customer name/email read from the embedded `customer` object.
- [x] 3.2 Rewrite `order-detail-page.tsx`'s status section: a `Select` covering all 7 statuses (design.md Decision 1) replacing the "mark next" button, plus a "Cancel order" quick action that calls the same status-update mutation with `CANCELLED` (design.md Decision 2) instead of the dropped cancel endpoint.
- [x] 3.3 Update the payment dialog: method options for the real 9-value enum, `status` select defaulting to `PAID` (design.md Decision 3), balance-due calc reads `Number(payment.amount)`/`Number(order.totalAmount)`.
- [x] 3.4 Update the shipment dialog: status/tracking/carrier fields for the real shape; submit calls the branching `upsertShipment` from task 2.3.
- [x] 3.5 Update the Items/Totals card for renamed amount fields (`subtotal`/`discountAmount`/`shippingAmount`/`taxAmount`/`totalAmount`, all `Number()`-coerced) and item `unitPrice`/`totalPrice`.
- [x] 3.6 Update the Customer/Shipping-address/Status-history cards for the embedded `customer` object, nullable `shippingAddress` (new field names, handle `null`), and `statusHistory`'s `toStatus`/`createdAt` shape.

## 4. Shipping methods page

- [x] 4.1 Update `shipping-methods-page.tsx`: `description` optional, add an `estimatedDays` input, `price` display via `Number()`, drop the `_isShippingMethodReferenced` pre-delete check (design.md Decision 6).

## 5. Fix downstream field-rename breaks (design.md Decision 4)

- [x] 5.1 `dashboard.ts`: `o.fulfillmentStatus !== 'cancelled'` → `o.status !== 'CANCELLED'`; `o.total` → `Number(o.totalAmount)` (both occurrences).
- [x] 5.2 `customers.ts`: same two renames in `toRow()`.
- [x] 5.3 `returns.ts`: `o.fulfillmentStatus === 'delivered'` → `o.status === 'DELIVERED'`.
- [x] 5.4 `refunds.ts`: remove the `paymentStatus === 'refunded'` seed step (no real equivalent field); leave `listRefunds`/`createRefund` and their own local `refunds` array untouched.
- [x] 5.5 (found via typecheck, not anticipated in design.md) `customer-detail-page.tsx` and `refunds-page.tsx` call the real `useOrders()`/`PaymentMethod` directly (not just the sync shim) and broke the same way: `customer-detail-page.tsx` used a `customerId` filter `useOrders` no longer accepts (the real endpoint doesn't support it — filter the fetched page client-side instead) and `fulfillmentStatus`/`total`; `refunds-page.tsx` used the mock's 4-value lowercase `PaymentMethod` enum instead of the real 9-value one, and `o.total`. Fixed the same minimal way as the other four files — not a redesign of either page.

## 6. Verification

- [x] 6.1 Run `tsc -b --noEmit`, `eslint .`, and `vite build`. All clean.
- [x] 6.2 Runtime smoke check (no backend required): launched the dev server, faked an authenticated session, navigated Orders list/detail (incl. a not-found order id), Shipping Methods, Refunds, Dashboard, Customers list/detail, and Returns — no uncaught `pageerror`s, only expected CORS/network errors; screenshots confirm the orders list (Payment column correctly dropped) and detail-page skeleton render correctly.
- [ ] 6.3 End-to-end against a live backend (status change, record payment, create/update shipment). **Not done** — no backend instance was available in this environment, same as prior roadmap changes.
