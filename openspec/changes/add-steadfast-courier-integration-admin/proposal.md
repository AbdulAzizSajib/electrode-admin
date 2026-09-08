## Why

The backend change `add-steadfast-courier-integration` (in the server repo) makes bulk courier dispatch and delivery-status sync possible. Nothing in this panel can reach it. An operator still opens each order, reads the address off the screen, and types it into Steadfast's own portal — the work the server change exists to remove.

The gap is concrete: the orders list has no way to select rows at all, so "send these forty parcels" has no expression in this UI.

## What Changes

- **Row selection on the orders list.** The shared `DataTable` gains opt-in selection — a checkbox column, a select-all for the current page, and a selection count. Opt-in because ~117 pages share this component and only this one wants it.
- **A dispatch flow with a preview step.** Selecting orders and choosing "Send to Steadfast" first shows what will and will not go, per order and with reasons, before anything is sent. The operator confirms from that screen.
- **A result screen that survives partial success.** After dispatch, each order is reported as dispatched, ineligible, failed, or unconfirmed. Failures are retryable from the result; unconfirmed ones deliberately are not.
- **Courier state on the order detail page** — consignment id, tracking code, the courier's own status, and when it was last synced — plus single-order dispatch for the one-off case.
- **A courier column on the orders list**, so an operator scanning the list can see which parcels are with the courier without opening each.
- **Read-only shipment fields once a consignment exists.** The manual carrier/tracking/status dialog becomes non-editable for courier-owned shipments, matching the server's refusal, so the panel never offers a control whose effect the next sync undoes.
- **An attention state for courier cancellations.** A consignment the courier cancelled is surfaced for the operator to resolve; the panel never restocks or cancels on its own.
- **Courier balance** visible in the panel, and a courier return request raisable from an order.

## Capabilities

### New Capabilities
- `courier-dispatch`: the operator-facing courier workflow — selecting packed orders, previewing eligibility, dispatching in bulk, reading per-order outcomes, seeing consignment and delivery state on an order, and raising a courier return.

### Modified Capabilities
<!-- None. This panel's openspec/specs/ has not been synced from prior changes, so
     `order-fulfillment` and `admin-shell` have no main spec to delta against. The
     order-list and shipment-dialog behaviour that changes here is specified inside
     the new `courier-dispatch` capability instead. -->

## Impact

**Shared component** — `src/components/ui/data-table.tsx` gains optional selection props. Every existing caller must keep working untouched; selection is off unless asked for.

**New code** — `src/lib/api/courier.ts` (fetchers plus TanStack Query hooks, through the shared `request` helper) and a `src/features/sales/courier/` directory for the preview and result surfaces.

**Existing code** — `orders-list-page.tsx` gains selection, a bulk action bar and a courier column; `order-detail-page.tsx` gains a courier card and single-order dispatch, and its shipment dialog becomes conditionally read-only.

**Dependency** — this change cannot be applied before the server change ships. Every endpoint it calls is created there.

**Out of scope** — a courier settings screen (credentials are environment-held on the server and deliberately not editable here), storefront-facing tracking, and any second courier.
