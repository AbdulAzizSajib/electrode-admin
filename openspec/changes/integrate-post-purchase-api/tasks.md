## 1. Returns (`src/lib/api/returns.ts`)

- [x] 1.1 Reshape `ReturnRequest`: `status: 'REQUESTED'|'APPROVED'|'REJECTED'|'RECEIVED'|'PROCESSING'|'COMPLETED'|'CANCELLED'`; add `returnNumber`; items become `{id, orderItemId, orderItem: {productName, sku, quantity, ...}, quantity, reason}`; embed `order: {id, orderNumber, status}`. Drop admin-create (no such endpoint).
- [x] 1.2 Implement `listReturns` against `GET /returns` (`searchTerm`, `status`, `orderId`, `page`, `limit`), `getReturn` against `GET /returns/:id`, `updateReturnStatus` against `PATCH /returns/:id/status` (`{status, warehouseId?}` — warehouseId required client-side when status is `COMPLETED`).

## 2. Refunds (`src/lib/api/refunds.ts`)

- [x] 2.1 Reshape `Refund`: `status: 'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'|'CANCELLED'` (read-only — no update endpoint, design.md Decision 1); drop `method` (refunds don't have one); add `reason?`, `paymentId?`, embedded `order: {id, orderNumber}`.
- [x] 2.2 Implement `listRefunds` against `GET /refunds` (`status`, `orderId`, `paymentId`, `page`, `limit` — no search) and `createRefund` against `POST /orders/:id/refunds` (`{amount, reason?, paymentId?, returnRequestId?}`, design.md Decision 2).

## 3. Reviews (`src/lib/api/reviews.ts`)

- [x] 3.1 Reshape `Review`: `status` gains `'HIDDEN'` (4 values total); add `adminReply?`, `title?`; embed `customer: {id, firstName, lastName, avatar}` and, admin-list only, `product: {id, name, slug}`. Drop `updateReviewContent`/`useUpdateReviewContent`/`deleteReview`/`useDeleteReview` — no such endpoints (design.md Decision 3).
- [x] 3.2 Implement `listReviews` against `GET /reviews/admin` (`status`, `productId`, `rating`, `page`, `limit`), `updateReviewStatus` against `PATCH /reviews/:id/status`, and a new `replyToReview` against `PATCH /reviews/:id` (`{adminReply}`).

## 4. Returns pages

- [x] 4.1 Update `returns-page.tsx`: 7-value status label/variant maps; items column reads `item.orderItem.productName`/`item.quantity`; order number from embedded `order.orderNumber`.
- [x] 4.2 Update `return-detail-page.tsx`: status actions cover the full lifecycle (not just requested/approved/completed — at least Approve/Reject from Requested, Complete-with-warehouse from Approved, matching what the backend allows); items list reads the embedded `orderItem` shape.

## 5. Refunds page

- [x] 5.1 Rebuild the create-refund dialog in `refunds-page.tsx`: order picker (unchanged), amount, optional reason, optional payment/return-request link — drop the `method` field; drop the row/detail "mark completed" action (design.md Decision 1); refund list reads embedded `order.orderNumber`.

## 6. Reviews page

- [x] 6.1 Update `reviews-page.tsx`: drop "Edit content"/"Remove" actions and their dialog/mutations; add a "Reply" action opening a textarea dialog that calls `replyToReview`; status label/variant maps cover `HIDDEN`; product/customer names read from embedded objects.

## 7. Verification

- [x] 7.1 Run `tsc -b --noEmit`, `eslint .`, and `vite build`. All clean.
- [x] 7.2 Runtime smoke check (no backend required): launched the dev server, faked an authenticated session, navigated Returns list/detail (incl. a not-found return id), Refunds, and Reviews — no uncaught `pageerror`s, only expected CORS/network errors.
- [ ] 7.3 End-to-end against a live backend (approve/complete a return, issue a refund, moderate + reply to a review). **Not done** — no backend instance was available in this environment, same as prior roadmap changes.
