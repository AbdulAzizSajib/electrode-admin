## Context

See `proposal.md` - Why/What Changes for motivation and the full field-level diff. Relevant current state, confirmed directly against the backend source (`server/prisma/schema/{Warehouse,Supplier,Stock,StockMovement,PurchaseOrder,PurchaseOrderItem}.prisma`, `server/src/app/module/{warehouse,supplier,stock,purchase-order}/*`, and the backend's own `openspec/specs/api/inventory/spec.md`), not just the mock:

- All five admin modules (`warehouses.ts`, `suppliers.ts`, `stock.ts`, `stock-movements.ts`, `purchase-orders.ts`) are in-memory mocks today; `integrate-products-api` already established the `request<T>()`/`ApiEnvelope<T>` pattern this change reuses verbatim.
- Endpoints (all under `checkAuth(OWNER, ADMIN, STAFF)` — never customer/anonymous-reachable, matching the backend's inventory spec):
  - `POST/GET /warehouses`, `GET/PATCH/DELETE /warehouses/:id`
  - `POST/GET /suppliers`, `GET/PATCH/DELETE /suppliers/:id`
  - `GET /stock` (filters: `warehouseId`, `productId`, `variantId` — no `searchTerm`, no free-text search), `PATCH /stock/:id/adjust` (`{ quantityDelta, note? }`)
  - `GET /stock-movements` (filters: `productId`, `variantId`, `warehouseId`, `type`)
  - `POST/GET /purchase-orders`, `GET/PATCH/DELETE /purchase-orders/:id`, `POST /purchase-orders/:id/receive`
- All list endpoints use the same `searchTerm`/`page`/`limit`/`sortBy` QueryBuilder convention as categories/brands/products.
- Every stock quantity change is paired with a `StockMovement` server-side (adjust, and purchase-order receipt) — enforced by the backend, not something the client has to orchestrate.
- Decimal columns (`Stock`/`PurchaseOrder`/`PurchaseOrderItem`'s cost/amount fields) serialize as strings, same `integrate-products-api` design.md note.

## Goals / Non-Goals

**Goals:**
- All five modules talk to the real backend with the same envelope/error handling already established.
- The purchase-order create → receive flow matches the real lifecycle (no warehouse at creation, receiving addressed by line-item id, real status set) rather than the mock's invented one.
- `warehouses.ts`'s `_getAllWarehouses()` keeps working (degraded, not broken) for `returns.ts`, which isn't migrated in this change.

**Non-Goals:**
- No UI for variant-scoped stock (`Stock.variantId`) — the real schema supports it (a `Stock` row can be scoped to a specific `ProductVariant`), but nothing in this change's scope (warehouses/suppliers/stock list/adjust/movements/purchase-orders) needs to create variant-scoped rows; they only ever appear via a future variant-aware receiving flow, which isn't this change. Product-level (`variantId: null`) stock is what's shown and adjusted.
- No new "create stock record" UI — `Stock` rows are only ever created as a side effect of a purchase-order receipt (an upsert, per `receivePurchaseOrder`'s find-or-create); nothing changes here.
- No migration of `returns.ts`, `orders.ts`'s own data, or any other module beyond the five listed — those are separate roadmap steps.
- No DAMAGE/LOSS/TRANSFER_IN/TRANSFER_OUT movement creation UI — the backend has no endpoint that produces those types yet (only ADJUSTMENT via stock-adjust and PURCHASE via PO-receive are reachable from any current endpoint), so the movement type label map covers all nine enum values for display but nothing in this change creates the other five.

## Decisions

**1. Purchase-order creation drops the warehouse selector; receiving gains one.**
The mock had `warehouseId` on the PO itself, fixed at creation. The real backend has no such column — `receivePurchaseOrder`'s payload carries `warehouseId` because a single PO could conceivably be received into different warehouses across multiple partial receipts (the schema doesn't prevent it), and the backend comment on `IReceivePurchaseOrderPayload` confirms this is deliberate, not an oversight. The form/detail pages follow the schema: create asks supplier + line items + optional cost fields; the receive dialog asks for the warehouse.

**2. Purchase-order status badges cover five values, and the detail page gains explicit status-transition actions.**
Mock: `pending | partially_received | received | cancelled`. Real: `DRAFT | ORDERED | PARTIALLY_RECEIVED | RECEIVED | CANCELLED`. Since `DRAFT` and `ORDERED` are both pre-receipt and both editable, and only their `status` field distinguishes "not yet sent to supplier" from "sent, awaiting delivery," the detail page adds a small "Mark as ordered" action (`PATCH { status: 'ORDERED' }`) alongside the existing receive/edit/delete actions, and a "Cancel" action (`PATCH { status: 'CANCELLED' }`) for either pre-receipt status. Receiving is allowed from any non-`CANCELLED`, non-fully-`RECEIVED` status (the backend only blocks those two), so the Receive button's visibility condition becomes `status !== 'CANCELLED' && status !== 'RECEIVED'` instead of the mock's `pending | partially_received` check — one extra state (`DRAFT`) can now go straight to receiving, matching the backend rather than assuming a business process it doesn't enforce.

**3. Receiving keys each input by `PurchaseOrderItem.id`, not `productId`.**
The mock's `receivePurchaseOrder(id, receipts: {productId, quantity}[])` breaks down the moment two line items share a product (the backend's `receivePurchaseOrderZodSchema` addresses items by their own id specifically to avoid that ambiguity). The receive dialog's per-row state and submit payload switch to keying by `item.id` (present on every `PurchaseOrderItem` in the loaded PO's `items[]`).

**4. `poTotal()` is deleted; `PurchaseOrder.totalAmount`/`subtotal`/`shippingCost`/`taxAmount` are read directly from the response** (each `Number()`-coerced per the Decimal-as-string note). The detail page shows a small breakdown (subtotal, shipping, tax, total) instead of a single computed total, since the fields now exist server-side and a breakdown is more useful than collapsing them back into one number.

**5. `stock-page.tsx`'s free-text product search becomes a product `Select` filter.**
`GET /stock` has no `searchableFields` (confirmed in `stock.service.ts`) — only `warehouseId`/`productId`/`variantId` filters. A text box that silently does nothing server-side would be worse than no search box; a product picker (`useProducts()`, already available) maps directly onto the `productId` filter the endpoint actually supports.

**6. `warehouses.ts`/`suppliers.ts` drop their client-side "is this referenced?" pre-delete checks.**
The mock's `useDeleteWarehouse(isReferenced)`/`useDeleteSupplier(isReferenced)` took a predicate computed from other mock data (stock records / purchase orders) to decide whether to even attempt the delete. The real `deleteWarehouse`/`deleteSupplier` already return a specific 409 with a clear message on the same conflict (foreign-key violation, `P2003`) — duplicating the check client-side would mean keeping two sources of truth in sync for no benefit, so both hooks just call delete and show whatever error comes back, same as `categories.ts`/`products.ts` already do.

**7. `_getAllWarehouses()` gets the same async-cache compatibility shim `_getAllProducts()` got; `_getAllSuppliers()`, `_restockWarehouse()`, and `_recordStockMovement()` do not.**
`returns.ts` (not part of this change) reads `_getAllWarehouses()` at seed time and inside `updateReturnStatus` purely for a warehouse's `id`/`name` — safe to keep as a lazily-populated cache. `_getAllSuppliers()` has no external readers, so it's just deleted along with the mock. `_restockWarehouse()`/`_recordStockMovement()` were synchronous mock-array mutators with no real-API shape to shim (a real restock is an async `PATCH`/`POST`, not a value you can hand back to the caller in the same tick) — `returns.ts`'s simulated "restock on return completion" block (which called both) is removed; the completed-return's own status/warehouse bookkeeping in `returns.ts`'s local array is untouched. Real restock-on-return arrives with `returns.ts`'s own migration.

## Risks / Trade-offs

- **[Risk]** Removing `returns.ts`'s simulated restock-on-completion means completing a return in the current mock UI no longer visibly bumps mock stock numbers → **Mitigation**: acceptable pre-launch; `returns.ts` gets real restocking (for real) in its own upcoming change rather than a fake version now.
- **[Risk]** The detail page's new "Mark as ordered"/"Cancel" actions are new UI, not a 1:1 swap of something that existed → **Mitigation**: directly required by the real status set (Decision 2); without them a `DRAFT` PO could never reach `ORDERED` through the UI at all.
- **[Risk]** Variant-scoped `Stock` rows (Non-Goals) could appear in the stock list if something outside this change's scope creates one later (e.g. a future variant-aware receiving flow) — the list would show them with `variant` populated but no way to filter to "product-level only" → **Mitigation**: out of scope; noted for whoever builds that later flow.

## Migration Plan

1. Reshape `Warehouse`/`Supplier`/`Stock`/`StockMovement`/`PurchaseOrder` types and swap each `src/lib/api/*.ts` function body to real `fetch` calls.
2. Update `warehouses-page.tsx`/`suppliers-page.tsx` forms and drop the pre-delete reference checks.
3. Update `stock-page.tsx` (renamed fields, product-select filter) and `stock-movements-page.tsx` (renamed type enum, dropped `balanceAfter` column).
4. Rebuild `purchase-order-form-page.tsx` (drop warehouse, rename `quantityOrdered`→`quantity`, add shipping/tax inputs) and `purchase-order-detail-page.tsx` (receive dialog keyed by item id + warehouse select, status-transition actions, totals breakdown).
5. Fix `returns.ts`'s now-broken calls (Decision 7) so the app keeps compiling; no other cross-file fixes expected (unlike `integrate-products-api`, nothing here is read synchronously at another module's *load* time in a way that risks a divide-by-zero-style crash — confirm this during implementation regardless).
6. No feature flag or gradual rollout — same reasoning as `integrate-products-api`: pre-launch admin panel, single change.
