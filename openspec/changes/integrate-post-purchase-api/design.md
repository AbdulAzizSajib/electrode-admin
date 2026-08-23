## Context

See `proposal.md` for the full field-level diff, confirmed against `server/prisma/schema/{ReturnRequest,ReturnItem,Refund,Review}.prisma` and `server/src/app/module/{return,refund,review}/*`.

- Endpoints: `POST /orders/:id/returns` (customer-only, ownership-scoped), `GET /returns`, `GET /returns/:id`, `PATCH /returns/:id/status` (staff-only, `{status, warehouseId?}`); `POST /orders/:id/refunds` (staff-only, `{amount, reason?, paymentId?, returnRequestId?}`), `GET /refunds` (staff-only, no search, filters `status`/`orderId`/`paymentId`); `GET /reviews/admin` (filters `status`/`productId`/`rating`), `PATCH /reviews/:id/status`, `PATCH /reviews/:id` (`{adminReply}` — a distinct endpoint from status).
- All three follow the same envelope/role-gating pattern already established.

## Goals / Non-Goals

**Goals:**
- All three modules talk to the real backend with the established envelope/error pattern.
- Each admin page only offers actions the backend actually supports (no return-create, no review edit/delete, no refund status-update).

**Non-Goals:**
- No client-side workaround for the missing refund status-update or review edit/delete endpoints (e.g. faking them by only updating local state) — if the business needs those, they're backend feature requests.
- No migration of anything beyond these three files — `orders.ts`/`products.ts`/`warehouses.ts` etc. are already real from prior roadmap steps and untouched here.

## Decisions

**1. Refunds page drops any "mark completed" action entirely — there's no endpoint that would do anything.**
The mock treated a refund as instantly `completed`. The real `Refund.status` defaults `PENDING` and nothing in this codebase's routes ever changes it. Rather than inventing a client-only "mark as done" that doesn't call anything, the refunds list just shows whatever status the backend returns (always `PENDING` in practice, today) with no status action — an honest reflection of the current backend surface, not a missing feature to paper over.

**2. Create-refund dialog is keyed off an order, not a bare `{orderId, amount, method}`.**
The real endpoint is nested under an order (`POST /orders/:id/refunds`) and has no `method` field (a refund isn't a payment — it doesn't need one; `paymentId` optionally links it to the payment being reversed). The form keeps its order picker (still useful to choose which order) but the fields underneath become amount, optional reason, and optional payment/return-request links instead of a payment method.

**3. Reviews page trades "Edit content"/"Remove" for "Reply".**
Neither editing a customer's review text nor deleting a review has a backend endpoint — those mock actions are removed outright, not degraded. `adminReply` is a real field with a real endpoint the mock never surfaced; adding a "Reply" dialog (textarea → `PATCH /reviews/:id`) uses an actual capability instead of two fictional ones.

## Risks / Trade-offs

- **[Risk]** Refunds admin UI feels inert (no per-refund action) once "mark completed" is removed (Decision 1) → **Mitigation**: accurate to the backend today; flagged as a backend follow-up if refund lifecycle management becomes a real need.
- **[Risk]** Losing the ability to edit/delete a review's content (Decision 3) removes a moderation lever the mock had → **Mitigation**: Hidden status (real, newly exposed) covers the "make this not show publicly" need; outright content editing was arguably not a good admin capability to have anyway (customers' own words shouldn't be silently rewritten).

## Migration Plan

1. Reshape `ReturnRequest`/`Refund`/`Review` types and swap each `src/lib/api/*.ts` function body to real `fetch` calls.
2. Update `returns-page.tsx`/`return-detail-page.tsx` for the 7-value status and embedded shapes.
3. Rebuild the refund-create dialog in `refunds-page.tsx` for the real payload; drop the status action.
4. Update `reviews-page.tsx`: drop edit/delete, add reply, extend status handling to `HIDDEN`.
5. No feature flag or gradual rollout — same reasoning as prior roadmap changes.
