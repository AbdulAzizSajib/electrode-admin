## Context

See `proposal.md` for the full field-level diff, confirmed against `server/prisma/schema/{order,OrderItem,OrderStatusHistory,Payment,Shipment,ShippingMethod}.prisma`, `server/src/app/module/{order,payment,shipment,shipping-method}/*`, and the backend's own `openspec/specs/api/checkout/spec.md`.

- Endpoints: `POST/GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` (customer self-service only), `PATCH /orders/:id/status` (staff-only), `POST/GET /orders/:id/payments`, `GET/POST/PATCH /orders/:id/shipment`, `POST/GET /shipping-methods`, `GET /shipping-methods/admin[/:id]`, `PATCH/DELETE /shipping-methods/:id`.
- `GET /orders` role-scopes results (staff see all, a customer only their own) server-side — the admin panel, always calling as staff, sees everything with no client-side filtering needed.
- `ORDER_DETAIL_INCLUDE` embeds `items`, `payments`, `shipments` (with `shippingMethod`), `statusHistory`, `shippingAddress`, and a lightweight `customer` selection — `getOrder` needs no follow-up requests for any of this.
- `ORDER_LIST_INCLUDE` embeds only `customer` (`id`, `firstName`, `lastName`) — no payments/shipments on list rows.

## Goals / Non-Goals

**Goals:**
- All four modules talk to the real backend with the established envelope/error pattern.
- The order status UI matches what the backend actually allows (any status, no sequence, cancel via status-update) instead of the mock's invented forward-only flow.
- `_getAllOrders()`/`_getOrderById()` keep working (degraded, not broken) for `dashboard.ts`, `customers.ts`, `refunds.ts`, `returns.ts`.

**Non-Goals:**
- No admin order creation — there is no backend capability for it (see proposal.md). If the business later needs phone/manual orders, that's a backend feature request, not something to fake client-side.
- No migration of `dashboard.ts`, `customers.ts`, `refunds.ts`, `returns.ts` themselves — only the minimal field-rename fixes needed to keep them compiling and correct against the reshaped `Order` (see Decision 4). Their own real-API migrations are separate roadmap steps.
- No client-side reconstruction of a per-order "payment status" for the orders list — the list endpoint doesn't embed payments, and computing one would mean an extra request per row. The order detail page already shows real payment records and a computed balance; the list just won't have a payment badge anymore.

## Decisions

**1. The order detail page's fulfillment action becomes a plain status `Select`, not a "mark next" button.**
The mock's `FULFILLMENT_SEQUENCE` array and the button that always advances to `sequence[currentIndex + 1]` assumed a rule the backend doesn't have — `updateOrderStatus` accepts any of the 7 `OrderStatus` values (rejecting only a same-status no-op). A `Select` with all 7 options, plus an optional note field, maps directly onto what the endpoint accepts, and removing the fake sequence removes a whole class of "why can't I skip to Delivered" friction that had no backend justification anyway.

**2. Cancel is the same status-update call with `status: 'CANCELLED'`, not a separate action.**
The dedicated `PATCH /orders/:id/cancel` is customer-self-service (see proposal.md) and would 404 for every admin-initiated call in practice. The detail page's "Cancel order" affordance either disappears in favor of just picking Cancelled from the status `Select`, or stays as a convenience button that calls the same `updateOrderStatus` mutation with `status: 'CANCELLED'` pre-filled — going with the latter (kept as a quick action) since "cancel" is common enough to deserve a shortcut, it just now hits the right endpoint.

**3. Payment form: `amount` stays required and pre-filled with balance due; `status` defaults to `PAID`.**
Both are optional on the backend (amount defaults to the order's full `totalAmount`; status defaults `PENDING`), but neither default matches admin intent well: defaulting amount to the *full order total* regardless of prior payments would silently overstate a partial payment, and a freshly recorded payment an admin is manually entering is normally already confirmed, not pending. Keeping `amount` required (pre-filled, editable) and defaulting `status` to `PAID` (with `PENDING`/`FAILED`/etc. still selectable) reproduces the mock's "recording a payment means it happened" UX while staying truthful to what's actually being sent.

**4. Minimal field-rename fixes to the four external `_getAllOrders()`/`_getOrderById()` consumers, not migrations:**
- `dashboard.ts`, `customers.ts`: `o.fulfillmentStatus !== 'cancelled'` → `o.status !== 'CANCELLED'`; `o.total` → `Number(o.totalAmount)`.
- `returns.ts`: `o.fulfillmentStatus === 'delivered'` → `o.status === 'DELIVERED'`.
- `refunds.ts`: `o.paymentStatus === 'refunded'` has no real equivalent — `Order` carries no payment/refund rollup field at all now (that state lives on `Payment`/`Refund` records, which `refunds.ts` doesn't read). Its seed step (pre-populating a few "already refunded" mock refunds at startup) is removed rather than approximated; `refunds.ts`'s own CRUD (`listRefunds`/`createRefund`) is untouched and keeps working against its own local array, just starts empty instead of pre-seeded. Real refund-aware behavior arrives with `refunds.ts`'s own migration.
None of these four files' `_getAllOrders()` calls index by array position (`%`) the way `orders.ts`'s own former seeding did, so none of them carry the divide-by-zero crash risk `integrate-products-api` had to guard against — confirmed by re-reading each call site.

**5. Shipment dialog picks `POST` vs `PATCH` client-side based on whether a shipment is already loaded**, keeping one dialog/one mutation function (`upsertShipment`-shaped from the caller's perspective) instead of exposing two separate mutations to the page — the branch lives in one small helper in `shipments.ts`, not duplicated in the component.

**6. `shipping-methods-page.tsx` drops `_isShippingMethodReferenced` without replacing it with a backend-error-based check.**
Unlike warehouses/suppliers/products, `deleteShippingMethod` on the backend has no `P2003` catch — an FK conflict (a `Shipment` still referencing it) would surface as a raw, unfriendly error rather than a clean 409 message. Since neither the client-side mock check nor a clean backend message is available, the delete button just calls delete and shows whatever error comes back (possibly an ugly one) — a known rough edge, not something worth adding bespoke client-side FK-checking logic to paper over (that would mean re-deriving "is this method referenced by any shipment" from data the admin panel doesn't otherwise fetch in bulk).

## Risks / Trade-offs

- **[Risk]** Deleting a shipping method that's in use will show a possibly-unfriendly backend error (Decision 6) → **Mitigation**: none client-side; flagged as a backend follow-up if it proves disruptive in practice.
- **[Risk]** The orders list loses its Payment column (Non-Goals) → **Mitigation**: payment info is one click away on the order detail page, which already shows real records; acceptable trade-off against an N+1 fetch per list row.
- **[Risk]** `refunds.ts` no longer starts with pre-seeded mock refunds (Decision 4) → **Mitigation**: pre-launch admin panel, no real users depending on demo data; `refunds.ts`'s own migration restores real seeded-by-reality data.

## Migration Plan

1. Reshape `Order`/`Payment`/`Shipment`/`ShippingMethod` types and swap each `src/lib/api/*.ts` function body to real `fetch` calls; keep `_getAllOrders()`/`_getOrderById()` as an async-cache shim (same shape as `_getAllProducts()`); drop `_setOrderPaymentStatus`/`_advanceOrderToShipped`/`_isShippingMethodReferenced`/`_getAllShippingMethods` outright.
2. Fix the four external consumers' field renames (Decision 4) so the app keeps compiling.
3. Rebuild `order-detail-page.tsx`'s status/payment/shipment sections; update `orders-list-page.tsx` (drop Payment column, 7-value status); update `shipping-methods-page.tsx` (optional description, `estimatedDays`, dropped pre-delete check).
4. No feature flag or gradual rollout — same reasoning as prior roadmap changes.
