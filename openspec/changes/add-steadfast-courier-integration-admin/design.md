## Context

See proposal.md — Why. The server-side contract is `add-steadfast-courier-integration` in the server repo; read its design.md before starting here, particularly Decisions 4 and 6, which this panel's result screen exists to expose.

Three facts about the current panel shape the approach.

**`DataTable` is shared by roughly 117 pages.** It is the list half of the CRUD scaffolding described in `resource-list-page.tsx`, and it has no notion of selection today. Anything added to it lands everywhere at once.

**The orders list is not a `ResourceListPage`.** `orders-list-page.tsx` drives `DataTable` directly, because it carries behaviour the scaffold does not have — scan-to-open, an auto-focused search box, a status filter. So selection can be wired here without touching the scaffold's other callers.

**Every API module goes through one helper.** `src/lib/api/<resource>.ts` exports fetchers and their TanStack Query hooks over the shared `request()` in `request.ts`, which unwraps the envelope and throws `ApiError` carrying the backend's own message. The result screen depends on that message surviving.

## Goals / Non-Goals

**Goals:**
- Dispatching forty parcels is one selection and one confirmation.
- No outcome is hidden: every order in a dispatch is accounted for by name.
- The panel never offers a control the server will refuse.
- The 116 other lists are untouched.

**Non-Goals:**
- Generalising selection into `ResourceListPage`. Only one surface needs it; adding it to the scaffold would push a concept onto every catalogue page that has no use for it.
- Client-side eligibility rules. The server decides what may be dispatched; duplicating those rules here creates a second source of truth that drifts.
- Optimistic updates on dispatch. The whole point of the result screen is that the outcome is not predictable.

## Decisions

### 1. Selection is opt-in on `DataTable`, controlled by the caller

`DataTable` gains optional props — a selection state, a change handler, and a row-id accessor. Absent them, it renders exactly as it does now: no checkbox column, no header checkbox, no behavioural change. Selection state lives in `orders-list-page.tsx`, not inside the table, for the same reason sorting and pagination already do — the page owns what it does with it.

*Alternative considered:* an internal, uncontrolled selection state read via a ref. Rejected — the bulk action bar needs to render from the selection, and a ref cannot drive that.

**The checkbox cell must stop propagation.** The orders list navigates on row click, so without it, ticking a box opens the order and loses the selection. This is the one interaction most likely to be got wrong, and it is called out in the spec for that reason.

### 2. Selection clears on page, filter or search change

Rows the operator can no longer see must not remain selected. Keeping them would mean a count of "12 selected" while four rows are visible, and a dispatch that includes orders the operator has not looked at since narrowing the filter. Clearing is the conservative reading of what the operator meant.

The alternative — selection persisting across pages, as some admin tables do — is defensible for a delete-many flow where the objects are interchangeable. It is not defensible when each row is a parcel with a COD amount.

### 3. Preview is a real server round-trip, not a local guess

The preview calls the server's `POST /courier/dispatch/preview` rather than filtering by status in the browser. Eligibility depends on things this panel does not hold — whether a composed address exceeds 250 characters, whether a stored phone converts to the courier's format, whether a consignment already exists. Guessing at them here would show the operator a preview that the dispatch then contradicts.

It also keeps one rule set. When the server's eligibility rules change, this panel is already correct.

### 4. The result screen distinguishes failed from unconfirmed, and only retries the first

The server reports four outcomes; the difference between `failed` and `unconfirmed` is the one that matters. A failed order definitely has no consignment and is safe to send again. An unconfirmed one may already have a consignment nobody has seen yet, and retrying it is how a merchant pays for two pickups of one parcel.

So retry is offered only for failures. Unconfirmed orders are shown in their own group, described as possibly-sent, with an instruction to check before acting. This mirrors what the storefront already does with a checkout timeout.

*Alternative considered:* a single "retry all that didn't go" button. Rejected outright — it is precisely the action the server's design works to prevent.

### 5. Courier state is read from the order, not fetched per row

The orders list already receives orders from one paginated endpoint. The courier column reads consignment presence and courier status off that same payload, requiring the list endpoint to include them — a server-side inclusion, not 20 extra requests from the browser. A per-row lookup would put the list back into the N+1 pattern `integrate-orders-api` explicitly removed.

### 6. The shipment form reads its own disabled state from the shipment

Rather than a separate "is courier order" flag threaded through the page, the form disables its fields when the loaded shipment has a `consignmentId`. One condition, derived from the data already present, and it cannot disagree with what the server will accept.

Fields are rendered disabled with an explanation rather than hidden. A hidden tracking number reads as "this order has none"; a disabled one with "managed by Steadfast" beside it says what is actually true.

### 7. Dispatch surfaces live in `features/sales/courier/`, beside orders

The preview and result screens are their own components under `src/features/sales/courier/`, not inline in `orders-list-page.tsx`, which is already carrying scan-to-open and its focus management. The order detail page's courier card lives there too and is imported, so single-order and bulk dispatch share one result presentation.

Per the panel's established pattern, these are pages rather than modals where they carry real content — `replace-admin-modals-with-pages` moved eight surfaces out of overlays for reasons that apply here: a dispatch result of forty rows is not overlay content.

## Risks / Trade-offs

**A shared component change breaks unrelated lists** → Selection is entirely opt-in and absent by default. The existing `data-table` tests plus at least one existing list's test must pass unchanged, and that is a task rather than an assumption.

**The operator retries an unconfirmed dispatch anyway, from the list** → The result screen refuses to offer it, but nothing stops re-selecting the order later. The real defence is server-side: an order that already carries a consignment is refused. This panel's job is to not encourage it.

**Selection is lost by an accidental filter change** → Accepted, and preferred to the alternative. Re-selecting is cheap; dispatching an unseen parcel is not.

**Courier state on the list depends on a server-side payload change** → If the list endpoint does not carry it, the column shows nothing rather than fanning out per-row requests. Verifying the payload is a task, ordered before the column is built.

**This change is inert without the server change** → It cannot be applied first; every endpoint is created there. Stated in the proposal's Impact and again as the first task.

## Migration Plan

1. Apply and deploy the server change first.
2. Add selection to `DataTable`; confirm existing lists and their tests are unchanged before anything else is built on it.
3. Build the API module, then preview, then dispatch, then the result screen — each usable before the next is started.
4. The courier column last, after the list payload is confirmed to carry what it needs.

**Rollback:** remove the bulk action bar and the courier surfaces. The `DataTable` selection props can stay — unused, they change nothing.
