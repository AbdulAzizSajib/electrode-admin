## Why

`src/lib/api/returns.ts`, `refunds.ts`, and `reviews.ts` are still in-memory mocks, and each models at least one capability the real backend doesn't have: returns are customer-created only (no admin-create), review content can't be edited or deleted by admin (only status-moderated and replied to), and refund status has no update endpoint at all. This is the next roadmap step after `integrate-orders-api` — swap all three to the real backend and correct each admin UI to match what the backend actually lets an admin do.

## What Changes

- Replace every function body in `src/lib/api/returns.ts`, `refunds.ts`, `reviews.ts` with real `fetch` calls, following the established `request<T>()` envelope pattern.
- **BREAKING** (internal only): reshape each type:
  - `ReturnRequest`/`ReturnStatus`: 7 values (`REQUESTED | APPROVED | REJECTED | RECEIVED | PROCESSING | COMPLETED | CANCELLED`, not the mock's 4); items reference `orderItemId` with an embedded `orderItem` object (not a flat `productId`/`productName`); the return itself embeds `order: {id, orderNumber, status}`; add `returnNumber`. **No admin-create** — returns are customer-created only (`POST /orders/:id/returns`, always scoped to the caller's own order), matching the pattern `integrate-orders-api` already established for orders themselves. `COMPLETED` still requires a `warehouseId` (restocks, same as the mock modeled) — confirmed unchanged.
  - `Refund`: `status` is a 5-value enum (`PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED`) that **has no update endpoint at all** — a refund is created and then its status is whatever it is; nothing in this admin panel can move it. The mock's "mark completed" UX therefore doesn't exist for refunds specifically (it does for returns, via return status). Refund creation moves to a per-order endpoint (`POST /orders/:id/refunds`, staff-only) taking `{amount, reason?, paymentId?, returnRequestId?}` — optionally linking a refund to a specific payment or return request (linking to a `returnRequestId` also auto-completes that return, a backend side effect, not something the client orchestrates).
  - `Review`: `status` gains a 4th value, `HIDDEN` (mock only had 3). **No admin edit-content and no admin delete** — neither endpoint exists; the mock's "Edit content"/"Remove" actions are dropped. **Admin reply is a real, separate capability** (`PATCH /reviews/:id` with `{adminReply}`) the mock never modeled at all — added as a new "Reply" action.
- Update `returns-page.tsx`/`return-detail-page.tsx` for the 7-value status, embedded `orderItem`/`order` shapes, and the unchanged complete-with-warehouse flow.
- Update `refunds-page.tsx`: the create-refund dialog moves from a standalone `{orderId, amount, method}` shape to the real `{amount, reason?, paymentId?, returnRequestId?}` posted to `/orders/:id/refunds`; drop the `method` field (refunds don't have one — only payments do); drop any "mark completed" action (no endpoint).
- Update `reviews-page.tsx`: drop "Edit content"/"Remove" (no endpoints); add a "Reply" action/dialog for `adminReply`; status actions cover `HIDDEN` too.

## Capabilities

### New Capabilities
- `post-purchase`: return visibility and status management (including restock-on-complete), refund creation, and review moderation (status + admin reply), backed by the real endpoints — explicitly scoped to what an admin can actually do, since return creation and review-content editing/deletion aren't admin capabilities the backend exposes.

### Modified Capabilities
(none)

## Impact

- **Code**: `src/lib/api/returns.ts`, `refunds.ts`, `reviews.ts` (mock → real fetch); `src/features/sales/returns/returns-page.tsx`, `return-detail-page.tsx`, `src/features/sales/refunds/refunds-page.tsx`, `src/features/customers/reviews/reviews-page.tsx`.
- **Depends on `integrate-orders-api`** (returns/refunds reference real orders) and **`integrate-products-api`** (reviews reference real products) — both done.
- **Backend dependency**: `{{base_url}}/returns`, `/orders/:id/returns`, `/orders/:id/refunds`, `/refunds`, `/reviews/admin`, `/reviews/:id[/status]` must be reachable.
- **No compatibility shim needed**: none of `returns.ts`/`refunds.ts`/`reviews.ts` export a synchronous getter any other still-mock module reads (confirmed — each is only imported by its own page).
