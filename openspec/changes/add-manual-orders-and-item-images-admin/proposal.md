## Why

A large share of this merchant's sales are agreed in a WhatsApp or Messenger conversation, and the panel has no way to record one. The operator's only options today are to ask the customer to re-enter everything on the storefront, or to leave the sale out of the system entirely — in which case it deducts no stock, joins no report, prints no invoice and cannot be handed to the courier. Every fulfilment surface the panel has is built on an order existing, and a sizeable slice of the shop's revenue never becomes one.

Separately, both order surfaces describe what was bought in words only. An operator packing a parcel, or answering "is this the black one?" on a call, is matching a picture against a shelf, and the list and detail pages hand them a product name to do it with. The panel's other catalog surfaces all show thumbnails; orders are the one place it matters most and the one place they are missing.

The backend work is `add-manual-orders-and-item-images` in the server repo, and lands first. This change is the operator-facing half.

## What Changes

**Product images on order surfaces**

- `OrderLineItem` gains `image`, which the server now returns on list and detail reads alike.
- The orders table's Items column shows a thumbnail beside each line's name; the order detail page's items table gains a leading image cell.
- A shared `Thumbnail` component — currently a private `Thumb` inside the product form's media sidebar — is promoted to `components/ui/` so the two order surfaces and the product form all degrade to the same placeholder on a missing or broken image, instead of each page inventing its own broken-image behaviour.

**Manual order creation**

- A new page at `/sales/orders/new`, reached from a Create button on the orders list, letting staff record an order taken over WhatsApp, Messenger, a phone call or in person.
- The form collects the customer's phone and name, a delivery address, a delivery option, the catalog lines they agreed to buy, the channel they came through, and an optional negotiated discount with a reason.
- Line prices come from the catalog and are shown, not typed — the server ignores a price sent in the body. A negotiated price is entered once as an order-level discount, which is what a WhatsApp haggle actually is.
- The form shows a live running total (subtotal, discount, delivery, tax, total) so the operator can read the figure back to the customer before saving, and so a surprise at save time is impossible.
- Submitting sends an `Idempotency-Key`, so a double-click on a slow connection cannot send the customer two parcels.
- On success the panel navigates to the created order's detail page — the operator's next action is nearly always to confirm it or print an invoice.

**Order provenance in the UI**

- Orders carry a channel; the list shows it and can be filtered by it, so "which of these came from WhatsApp" is answerable at a glance.
- A manually created order names the staff member who created it on its detail page.

## Capabilities

### New Capabilities

- `manual-order-entry`: the operator-facing flow for recording an order a customer placed off-site — how the customer and lines are identified, how the price is shown and negotiated, what the operator sees before committing, and how a failed or repeated save behaves.

### Modified Capabilities

- `order-fulfillment`: the orders list and order detail show each line's product image; the list shows and filters by the channel an order came through; order detail names the staff member who created a manual order.

## Impact

**New files** — `src/features/sales/orders/order-create-page.tsx` and its test, `src/components/ui/thumbnail.tsx`.

**Modified** — `src/lib/api/orders.ts` (`OrderLineItem.image`, `OrderChannel`, `Order.channel` / `createdBy`, `discountReason`, a `channel` list param, `createManualOrder` + its mutation hook), `orders-list-page.tsx` (thumbnails, channel column and filter, Create button), `order-detail-page.tsx` (image cell, channel and creator, discount reason), `routes/app-router.tsx` (the new route, above `/sales/orders/:orderId` so the literal is not captured as an id), `media-sidebar.tsx` (drop the private `Thumb` for the shared one), and `src/lib/api/query-keys.ts` if the orders list key needs the new filter.

**Depends on** — the server change, `add-manual-orders-and-item-images`. **This has now landed**: `POST /orders/manual`, `POST /orders/quote/manual`, the `channel` list filter, and `items[].image` / `channel` / `createdByUserId` / `discountReason` on order reads are all live and verified by `verify-manual-order.ts` (38 checks). Note the staff quote route is `/orders/quote/manual`, not a widened `/orders/quote` — see design.md, Decision 2.

**Not affected** — the storefront. It cannot reach the new endpoint and its own order reads already carry images.

**Follow-up to record, not do here** — `order-fulfillment`'s Purpose currently states that "order creation is explicitly out of scope: the real backend only creates orders through customer checkout, which this admin panel does not perform." That sentence stops being true with this change. A Purpose cannot be changed by a delta, so it has to be corrected in `openspec/specs/order-fulfillment/spec.md` when this change is synced or archived.
