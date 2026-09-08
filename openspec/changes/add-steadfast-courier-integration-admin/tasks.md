## 1. Prerequisite

- [x] 1.1 Confirm the server change `add-steadfast-courier-integration` is applied and its endpoints respond — this change is inert until then
- [x] 1.2 Confirm the orders list endpoint returns consignment presence and courier status per order; if it does not, that is a server-side task and the courier column (section 8) waits on it

## 2. Selection on the shared table

- [x] 2.1 Add optional `selection`, `onSelectionChange` and `getRowId` props to `src/components/ui/data-table.tsx`; render the checkbox column and header checkbox only when they are supplied
- [x] 2.2 Stop click propagation on the checkbox cell so ticking a box never triggers `onRowClick` (design Decision 1 — the interaction most likely to be got wrong)
- [x] 2.3 Verify the existing `data-table` behaviour is unchanged without the new props, and run at least one existing list page's tests untouched
- [x] 2.4 Add tests covering: individual selection, select-all-on-page, checkbox click not navigating, and row click still navigating

## 3. Courier API module

- [x] 3.1 Create `src/lib/api/courier.ts` over the shared `request()` helper, with types for the four per-order outcomes (dispatched, ineligible, failed, unconfirmed)
- [x] 3.2 Implement `previewDispatch`, `dispatchOrders`, `dispatchSingleOrder`, `getBalance` and `createReturnRequest` plus their TanStack Query hooks
- [x] 3.3 Add courier query keys to `src/lib/api/query-keys.ts`
- [x] 3.4 On a successful dispatch, invalidate the orders list, the affected order details and their shipments
- [x] 3.5 Ensure `ApiError`'s backend message reaches callers unchanged, so a refusal shows the server's own wording

## 4. Orders list selection and bulk action

- [x] 4.1 Add selection state to `orders-list-page.tsx` and wire it to `DataTable`
- [x] 4.2 Clear the selection whenever page, page size, search or status filter changes (design Decision 2)
- [x] 4.3 Add a bulk action bar showing the selection count and a "Send to Steadfast" action, visible only when something is selected
- [x] 4.4 Confirm scan-to-open and the auto-focused search box still behave as they do today

## 5. Dispatch preview

- [x] 5.1 Create `src/features/sales/courier/dispatch-preview.tsx` calling the server's preview endpoint — no client-side eligibility rules (design Decision 3)
- [x] 5.2 List orders that will be sent, and separately each excluded order with its server-supplied reason
- [x] 5.3 Offer no confirm action when nothing is eligible, and say why
- [x] 5.4 Disable the confirm control while a dispatch is in flight so one confirmation cannot be sent twice

## 6. Dispatch result

- [x] 6.1 Create `src/features/sales/courier/dispatch-result.tsx` reporting every order by name with its outcome, showing tracking codes for those dispatched
- [x] 6.2 Group unconfirmed orders separately from failures, described as possibly-sent with an instruction to check before acting (design Decision 4)
- [x] 6.3 Offer retry for definite failures only — never for unconfirmed orders, and never a single "retry everything that didn't go"
- [x] 6.4 Add a test asserting that no retry control is rendered for an unconfirmed outcome

## 7. Order detail courier surface

- [x] 7.1 Add a courier card to `order-detail-page.tsx` showing consignment id, tracking code, courier status and last-synced time
- [x] 7.2 State plainly that an order has not been dispatched when it carries no consignment, rather than rendering empty fields
- [x] 7.3 Add single-order dispatch for an eligible order, reusing the result presentation from section 6
- [x] 7.4 Offer no dispatch action for an ineligible or already-dispatched order, and say why
- [x] 7.5 Disable the shipment form's tracking number, carrier, status and timestamp fields when the shipment carries a `consignmentId`, naming Steadfast as their source; leave a shipment without one fully editable (design Decision 6)
- [x] 7.6 Add a courier return action for a dispatched order, with an optional reason, and hide it for an order with no consignment

## 8. Orders list courier column

- [x] 8.1 Add a courier column reading consignment presence and courier status from the existing list payload — no per-row requests (design Decision 5)
- [x] 8.2 Flag an order whose consignment the courier cancelled or returned as needing attention, in the list and on the detail page
- [x] 8.3 Confirm the flag changes no order status and offers no restock; direct the operator to the existing cancellation and return flows

## 9. Balance, configuration and finish

- [x] 9.1 Surface the courier balance, reporting unavailability as such rather than displaying zero
- [x] 9.2 When the server reports the courier unconfigured, say so and offer no dispatch action
- [ ] 9.3 Run `pnpm lint` and `pnpm test` clean
- [ ] 9.4 Walk the whole flow against the real backend: select packed orders, preview with a deliberately invalid one included, dispatch, read the result, then confirm the order detail and list both reflect the new consignment
