## Why

`src/lib/api/warehouses.ts`, `suppliers.ts`, `stock.ts`, `stock-movements.ts`, and `purchase-orders.ts` are all still in-memory mocks, and `purchase-orders.ts` in particular models a purchase-order lifecycle the real backend doesn't have (a `warehouseId` fixed at creation, status values that don't match, receiving addressed by product instead of by line item). This is the next step of the mock-to-real migration roadmap agreed after `integrate-products-api` (which this depends on — inventory records reference real `Product` ids) — swap all five to the real backend and redesign the purchase-order create/receive flow to match its actual contract, not the mock's.

## What Changes

- Replace every function body in `src/lib/api/warehouses.ts`, `suppliers.ts`, `stock.ts`, `stock-movements.ts`, `purchase-orders.ts` with real `fetch` calls, following the established `request<T>()` envelope pattern (`{ success, message, data, meta? }`, `credentials: 'include'`, `ApiError` on failure).
- **BREAKING** (internal only): reshape each type to match the real schema:
  - `Warehouse`: add `city?`, `country` (defaults `"Bangladesh"`), `updatedAt`; `address` becomes optional (was required).
  - `Supplier`: `contactEmail` → `email?` (optional, was required `contactEmail`); add `companyName?`, `city?`, `country`, **`isActive`** (the mock never had a supplier active/inactive flag; the real one does); `address` becomes optional.
  - `Stock`: `quantityOnHand` → `quantity`, `reserved` → `reservedQuantity`; embeds `product`/`variant`/`warehouse` objects instead of flat `productName`/`warehouseName` strings the mock joined by hand; adds variant-scoped stock (`variantId`), which this change surfaces but doesn't build variant-specific UI for (see design.md Non-Goals).
  - `StockMovement`: `type` enum changes from the mock's `'purchase_receipt' | 'adjustment' | 'return_restock' | 'sale'` to the real `PURCHASE | SALE | RETURN | REFUND | ADJUSTMENT | DAMAGE | LOSS | TRANSFER_IN | TRANSFER_OUT`; `quantityDelta` → `quantity`, `reason` → `note`; **`balanceAfter` is dropped** — the real schema has no running-balance column, and computing one client-side is out of scope.
  - **`PurchaseOrder` is restructured, not just renamed**:
    - `status`: `DRAFT | ORDERED | PARTIALLY_RECEIVED | RECEIVED | CANCELLED` (the mock's `pending` collapses into `DRAFT`/`ORDERED` — see design.md).
    - Create takes **no `warehouseId`** — the mock assumed one warehouse per PO from creation; the real backend only asks which warehouse a receipt lands in, at receive time, per line item receipt.
    - Line items: `quantity` (not `quantityOrdered`), plus server-computed `totalCost`; `subtotal`/`totalAmount` are computed server-side from items + optional `shippingCost`/`taxAmount`, not client-computed (`poTotal()` helper is dropped).
    - Editing (`PATCH`) is blocked once a PO has any receipt (`PARTIALLY_RECEIVED`/`RECEIVED`), same restriction the mock had, just phrased against the real status set; editable fields are `shippingCost`, `taxAmount`, `notes`, `orderedAt`, `status` (`DRAFT`/`ORDERED`/`CANCELLED` only — not the receipt-triggered statuses) — line items themselves aren't editable via `PATCH` (create-only).
    - **Receiving addresses a specific `PurchaseOrderItem.id`, not a `productId`**, and takes a `warehouseId` (the receipt's destination — the field the mock wrongly had on the PO itself).
- Redesign `purchase-order-form-page.tsx`: drop the warehouse selector (moves to the receive dialog); line items collect `productId`/`quantity`/`unitCost` (unchanged field count, `quantityOrdered` renamed `quantity`); add optional `shippingCost`/`taxAmount` inputs.
- Redesign the purchase-order detail page's receive dialog: add a warehouse `Select` (now required at receive time, not creation time); key each receive-quantity input by the line item's own `id`, not `productId`; add a status-transition affordance (`DRAFT → ORDERED`, or `→ CANCELLED`) using the same `PATCH` the edit form uses, since receiving no longer implicitly happens from a single "pending" state.
- Update `warehouses-page.tsx`'s form for the new/optional fields; drop its `isReferenced` client-side pre-check for delete (the real `deleteWarehouse`/`deleteSupplier` already return a proper 409 with a clear message on conflict — no need to duplicate that check client-side, matching how `categories.ts`/`products.ts` already just surface the backend's error).
- Update `suppliers-page.tsx`'s form to add `companyName`/`isActive`, rename `contactEmail` → `email`, and drop the same client-side reference pre-check.
- Update `stock-page.tsx` for the renamed fields and embedded `product`/`warehouse` objects; replace the free-text product search (not supported by the real `GET /stock` endpoint — it has no `searchableFields`) with a product `Select` filter, matching the `productId` filter the endpoint does support.
- Update `stock-movements-page.tsx` for the renamed type enum and dropped `balanceAfter` column.

## Capabilities

### New Capabilities
- `inventory-management`: warehouse/supplier/stock/stock-movement/purchase-order management backed by the real endpoints, including the purchase-order create → (optionally) mark-ordered → receive lifecycle and the audit-trail guarantee that every stock quantity change is paired with a `StockMovement`.

### Modified Capabilities
(none)

## Impact

- **Code**: `src/lib/api/warehouses.ts`, `suppliers.ts`, `stock.ts`, `stock-movements.ts`, `purchase-orders.ts` (mock → real fetch); `src/features/inventory/warehouses/warehouses-page.tsx`, `src/features/inventory/suppliers/suppliers-page.tsx`, `src/features/inventory/stock/stock-page.tsx`, `src/features/inventory/stock-movements/stock-movements-page.tsx`, `src/features/inventory/purchase-orders/purchase-orders-list-page.tsx`, `purchase-order-form-page.tsx`, `purchase-order-detail-page.tsx`.
- **Depends on `integrate-products-api`**: purchase-order line items and stock records reference real `Product` ids; this change assumes that one is done (it is — see openspec/changes/integrate-products-api).
- **Backend dependency**: `{{base_url}}/warehouses`, `/suppliers`, `/stock`, `/stock-movements`, `/purchase-orders` must be reachable.
- **`_getAllWarehouses()` needs the same kind of compatibility shim `integrate-products-api` gave `_getAllProducts()`**: `src/lib/api/returns.ts` (still mock, not touched by this change — it's part of the later `integrate-post-purchase-api` step) reads `_getAllWarehouses()` at module-seed time and inside `updateReturnStatus`. `_getAllSuppliers()` has no consumers outside the files this change migrates, so it can be removed outright. `_restockWarehouse()`/`_recordStockMovement()` (also read by `returns.ts`, to simulate restocking a completed return) don't get a shim — they were pure mock-array mutators with no real-API equivalent that returns synchronously, so `returns.ts`'s simulated restock/movement side effect is removed (its own local return-status bookkeeping is untouched); real restock behavior for returns arrives with that module's own migration later.
