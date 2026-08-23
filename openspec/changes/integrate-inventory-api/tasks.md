## 1. Warehouses (`src/lib/api/warehouses.ts`)

- [x] 1.1 Reshape `Warehouse`/`WarehouseInput`: `address` optional, add `city?`, `country`, `updatedAt`.
- [x] 1.2 Implement `listWarehouses` against `GET /warehouses` (`searchTerm`, `isActive`, `country`, `page`, `limit`), `createWarehouse` (`POST /warehouses`), `updateWarehouse` (`PATCH /warehouses/:id`), `deleteWarehouse` (`DELETE /warehouses/:id`) with the `request<T>()`/`ApiEnvelope<T>` pattern.
- [x] 1.3 Keep `_getAllWarehouses()` exported but reimplement as a lazily-populated async cache (same shape as `products.ts`'s `_getAllProducts()`) — `returns.ts` still reads it synchronously (see design.md Decision 7).

## 2. Suppliers (`src/lib/api/suppliers.ts`)

- [x] 2.1 Reshape `Supplier`/`SupplierInput`: `contactEmail` → `email?`, add `companyName?`, `city?`, `country`, `isActive`; `phone`/`address` become optional.
- [x] 2.2 Implement `listSuppliers` (`GET /suppliers`, `searchTerm`/`isActive`/`country`/`page`/`limit`), `createSupplier`, `updateSupplier`, `deleteSupplier` against the real endpoints.
- [x] 2.3 Remove `_getAllSuppliers()`/`_isSupplierReferenced()` — confirmed no external callers beyond `purchase-orders.ts` (migrated together) and `suppliers-page.tsx`'s own pre-delete check (dropped, task 5.2).

## 3. Stock (`src/lib/api/stock.ts`)

- [x] 3.1 Reshape `Stock`: `quantityOnHand` → `quantity`, `reserved` → `reservedQuantity`; embed `product: {id,name,sku}`, `variant: {id,name,sku} | null`, `warehouse: {id,name,code}` instead of flat name strings; drop the old `StockRow`'s hand-joined `productName`/`productSku`/`warehouseName` in favor of reading them off the embedded objects (keep computing `available = quantity - reservedQuantity` client-side, same as before).
- [x] 3.2 Implement `listStock` against `GET /stock` (`warehouseId`, `productId`, `variantId`, `page`, `limit` — no `searchTerm`, the endpoint doesn't support it) and `adjustStock` against `PATCH /stock/:id/adjust` (`{ quantityDelta, note }`).
- [x] 3.3 Remove `_getStockForProduct`, `_restockWarehouse` — `_restockWarehouse` has one external caller (`returns.ts`); fix that call site per task 6.1 rather than keeping a shim (design.md Decision 7).

## 4. Stock Movements (`src/lib/api/stock-movements.ts`)

- [x] 4.1 Reshape `StockMovement`/`StockMovementType`: real enum `PURCHASE | SALE | RETURN | REFUND | ADJUSTMENT | DAMAGE | LOSS | TRANSFER_IN | TRANSFER_OUT`; `quantityDelta` → `quantity`, `reason` → `note`; drop `balanceAfter` (no backend equivalent); embed `product`/`variant`/`warehouse` objects like `Stock`.
- [x] 4.2 Implement `listStockMovements` against `GET /stock-movements` (`productId`, `variantId`, `warehouseId`, `type`, `page`, `limit`).
- [x] 4.3 Remove `_recordStockMovement` — one external caller (`returns.ts`); fix per task 6.1.

## 5. Warehouses/Suppliers pages

- [x] 5.1 Update `warehouses-page.tsx`'s form for optional `address` and new `city`/`country` fields; drop the `isReferenced`/`useStock` pre-delete check, let `useDeleteWarehouse` surface the backend's 409 message directly.
- [x] 5.2 Update `suppliers-page.tsx`'s form: rename `contactEmail` → `email` (still required in the form as a UX choice, even though the backend field is optional — same precedent as products' required SKU), add `companyName` input and an `isActive` `Switch`; drop the `_isSupplierReferenced` pre-delete check.

## 6. Stock/Stock Movements pages

- [x] 6.1 Fix `returns.ts`'s now-broken calls: remove the `_restockWarehouse`/`_recordStockMovement` invocations in `updateReturnStatus`'s `'completed'` branch (no real-API equivalent exists yet — see design.md Decision 7); keep the local `restockedWarehouseId`/status bookkeeping on the `ReturnRequest` mock object as-is.
- [x] 6.2 Update `stock-page.tsx`: replace the free-text search box with a product `Select` (`useProducts()`) wired to the `productId` filter; update columns for `quantity`/`reservedQuantity`/embedded `product`/`warehouse`; update the adjust dialog to send `note` instead of `reason` (keep it required client-side).
- [x] 6.3 Update `stock-movements-page.tsx`: new type label/variant maps covering all nine real enum values; drop the "Balance after" column; update `quantityDelta`→`quantity`, embedded `product`/`warehouse` for the Product/Warehouse columns.

## 7. Purchase orders (`src/lib/api/purchase-orders.ts`)

- [x] 7.1 Reshape `PurchaseOrder`: `status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'`; drop `warehouseId` from the PO itself; items become `{ id, productId, quantity, unitCost, receivedQuantity, totalCost, product: {id,name,sku} }`; add `subtotal`, `shippingCost`, `taxAmount`, `totalAmount` (all Decimal-as-string), `supplier` (embedded object), `orderedAt?`, `receivedAt?`.
- [x] 7.2 Reshape `PurchaseOrderInput` (create): `{ supplierId, items: {productId, quantity, unitCost}[], shippingCost?, taxAmount?, notes?, orderedAt? }` — no `warehouseId`.
- [x] 7.3 Add a separate update input shape (`{ shippingCost?, taxAmount?, notes?, orderedAt?, status?: 'DRAFT'|'ORDERED'|'CANCELLED' }`) — items aren't editable via update.
- [x] 7.4 Add a receive input shape (`{ warehouseId, items: {purchaseOrderItemId, quantity}[] }`).
- [x] 7.5 Implement `listPurchaseOrders` (`GET /purchase-orders`, `searchTerm`/`status`/`supplierId`/`page`/`limit`), `getPurchaseOrder` (`GET /purchase-orders/:id`), `createPurchaseOrder` (`POST /purchase-orders`), `updatePurchaseOrder` (`PATCH /purchase-orders/:id`), `deletePurchaseOrder` (`DELETE /purchase-orders/:id`), `receivePurchaseOrder` (`POST /purchase-orders/:id/receive`).
- [x] 7.6 Delete `poTotal()` — callers read `Number(po.totalAmount)` (and `subtotal`/`shippingCost`/`taxAmount`) directly.

## 8. Purchase order pages

- [x] 8.1 Rewrite `purchase-order-form-page.tsx`: drop the warehouse `Select`; rename the line-item field `quantityOrdered` → `quantity`; add optional `shippingCost`/`taxAmount` number inputs; update `onSubmit`/`values` mapping for the new `ProductInput`-equivalent shape.
- [x] 8.2 Update `purchase-orders-list-page.tsx`: new status label/variant maps (5 values); replace `poTotal(row.original)` with `Number(row.original.totalAmount)`; supplier name reads from the embedded `supplier` object instead of a separate `useSuppliers()` lookup.
- [x] 8.3 Rewrite `purchase-order-detail-page.tsx`:
  - Line items table reads `item.product.name`/`item.product.sku` directly (no separate `useProducts()` lookup), plus `receivedQuantity`, `unitCost`, `totalCost`.
  - Totals breakdown: subtotal, shipping cost, tax amount, total (design.md Decision 4).
  - Receive dialog: add a warehouse `Select` (`useWarehouses()`); key each receive-quantity input by `item.id` instead of `item.productId`; submit `{ warehouseId, items: [{purchaseOrderItemId, quantity}] }`.
  - Add "Mark as ordered" action (`status: 'DRAFT'`, → `PATCH { status: 'ORDERED' }`) and a "Cancel" action (either pre-receipt status → `PATCH { status: 'CANCELLED' }`).
  - Receive button visibility: `status !== 'CANCELLED' && status !== 'RECEIVED'` (was `pending | partially_received`).
  - Edit button/link visibility: `status === 'DRAFT' || status === 'ORDERED'` (was `status === 'pending'`).
  - Delete button visibility: unchanged concept (`!hasReceived`, derived from `items.some(i => i.receivedQuantity > 0)`).

## 9. Verification

- [x] 9.1 Run `tsc -b --noEmit`, `eslint .`, and `vite build` to catch any remaining references to removed/renamed fields (`quantityOnHand`, `reserved`, `contactEmail`, `poTotal`, old `StockMovementType` values, `warehouseId` on `PurchaseOrderInput`).
- [x] 9.2 Runtime smoke check (no backend required, same approach as `integrate-products-api`): launch the dev server, fake an authenticated session, navigate Warehouses, Suppliers, Stock, Stock Movements, Purchase Orders list/new/detail, and confirm no uncaught `pageerror`s — only expected network/CORS errors.
- [ ] 9.3 Create a purchase order, mark it Ordered, receive it (full and partial), and adjust stock — end to end against a live backend. **Not done** — no backend instance was available in this environment, same as `integrate-products-api` tasks 4.1–4.3.
