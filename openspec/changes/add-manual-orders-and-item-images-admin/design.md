## Context

See proposal.md — Why. The server half is `add-manual-orders-and-item-images` in the server repo and lands first; everything below assumes `POST /orders/manual`, the `channel` filter on `GET /orders`, and `items[].image` on both order reads already exist.

What the panel already has, and what it constrains:

- **One form stack.** `components/crud/resource-form-page.tsx` is the panel's only authoring page, over `resource-form-layout.tsx`. Callers own their `useForm` and zod schema and pass the result in — which is exactly what lets a page state a rule the scaffold has never heard of. Its central guarantee is the one this form needs most: a refused save leaves every entered value untouched with the reason above the fields, and it brings the first failing control into view by `aria-invalid` so a Radix `Select` or `Combobox` is not silently skipped.
- **A very close precedent.** `features/inventory/purchase-orders/purchase-order-form-page.tsx` is 850 lines of exactly this shape: `useFieldArray` lines, a `Combobox` product picker backed by `useProducts`, a per-line variant picker that has to resolve a product's variants separately because `GET /products/admin` omits them, and a running total. It also carries a test file worth mirroring.
- **A private thumbnail.** `Thumb` in `features/catalog/products/components/media-sidebar.tsx` already does the right thing — placeholder on no URL, `onError` fallback to the same placeholder, `object-cover` in a fixed box — and is not exported.
- **Two known traps.** A Radix `Select` mounted before its data arrives clears react-hook-form's `values` reset (CLAUDE.md, and the panel has hit it before). `number-input` yields `undefined` for a cleared field, not `0`, and is meant to be paired with `lib/validation/numeric`.
- **`BASE_URL` is hardcoded** in `lib/api/client.ts`, and every resource module goes through the single `request()` helper, which unwraps the envelope and throws `ApiError` carrying the backend's own message.

## Goals / Non-Goals

**Goals**

- The operator can finish a WhatsApp conversation without leaving the panel, and read the final figure back before committing.
- The total on screen is the total the order is created with — obtained from the backend, never estimated locally.
- A refused save costs the operator nothing. This is the single most important property of the page; the customer is on the phone.
- Thumbnails are one component, so a missing image looks the same everywhere and the fix for a broken one is in one place.

**Non-Goals**

- Editing a placed order's lines. Creation only; the server does not offer it either.
- A customer picker. Phone is the identity, per the platform rule, and a searchable customer list is a second way to say the same thing that can disagree with the first.
- Coupons on a manual order. The server does not accept one (server design.md, Decision 5).
- Per-line price editing. The server ignores a price in the body by design; offering a control that does nothing would be worse than offering none.
- Channel reporting. This change shows and filters by channel; revenue-by-channel is downstream.
- Touching the storefront, which reads its own orders through paths that already carry images.

## Decisions

### Decision 1 — The total comes from `POST /orders/quote`, not from arithmetic in the browser

The form debounces changes to lines, delivery option and discount, calls the quote endpoint, and renders what comes back. It does not compute a total itself.

**Why.** The total is not `sum(price × qty) + delivery`. Tax is per product's own `taxRule`, the order discount is allocated across lines by value *before* tax, delivery can be waived by a free-shipping threshold, and all of that lives in `order.pricing.ts`. Reimplementing it in the panel would produce a number that is right until the first tax rule changes, and the operator would have already read it to the customer. The quote endpoint exists precisely because "two implementations of what does this cost is exactly how a quote and a charge drift apart" — its own words.

**This requires the server to support a staff quote**, including the manual discount, which is a dependency this change places on the server change rather than working around. See Decision 2.

**Alternatives considered.** Computing locally and letting the backend correct it at save time — rejected, because the correction arrives after the operator has quoted a price. Sending `expectedTotal` and showing whatever the server returns on rejection — that is a safety net, not a display strategy, and it turns a normal save into a failure the operator has to explain.

**While a quote is in flight** the summary shows the previous figure marked as updating rather than blanking, and the submit control is disabled until a fresh quote has landed — so the figure sent as `expectedTotal` is never one the operator did not see.

### Decision 2 — Dependency on the server change — **now landed, with one route change**

This change needed two things from `add-manual-orders-and-item-images` beyond the manual endpoint itself: a staff quote that does not create a `Customer` row for the operator's own account (`quoteCheckout` resolved `actor.kind === "user"` through `getOrCreateCustomerByUserId`, so a staff member pricing a basket would silently become a customer), and one that accepts the manual `discountAmount`, since subtracting a discount from an undiscounted quote is wrong — it changes the taxable amount per line.

**Both have shipped. The endpoints are:**

| | |
|---|---|
| `POST /orders/manual` | places the order; `Idempotency-Key` header; OWNER/ADMIN/STAFF |
| `POST /orders/quote/manual` | prices it; same guard; accepts `discountAmount` |

**The route differs from what this design first assumed.** It assumed `POST /orders/quote` would learn the staff actor. It cannot: that route runs under `optionalAuth`, and an **admin shopping on the storefront is a shopper like any other** whose own cart must still price there. Deciding the actor from the session's role would break that for every staff member who buys something. So the staff quote is its own route, and the actor is staff because the *route* is staff — a property of the endpoint rather than a guess about the person. It also keeps `discountAmount` unspellable on the shopper's quote schema, which is the same argument this design already makes for two placement routes.

Nothing else in this design moves: the form still quotes through the server, still never computes a total itself, and still sends the discount to be priced rather than subtracting it.

**Other server-side facts this page can now rely on**, verified by `verify-manual-order.ts` (38 checks):

- The customer is resolved by phone and the number is **normalized** before storage — `01712345678` is stored as `+8801712345678`. The form should not assume the string it sent is the string on the record.
- `channel` accepts `WHATSAPP | MESSENGER | PHONE | IN_STORE | OTHER`. `WEBSITE` is rejected: it is the column default and means the customer placed the order themselves.
- `discountReason` is required by the schema whenever `discountAmount > 0`; the error is pathed to `discountReason`, so the form marks that field rather than the whole form.
- The "discount may not exceed the subtotal" refusal comes from the **service**, not the schema — the subtotal is not knowable until the lines are priced. The form's own bound (Decision 5) is what stops the operator reaching it.
- Every order read now returns a flat `items[].image`, staff and customer alike, on list and detail.

### Decision 3 — A bespoke page over `resource-form-page`, not a new scaffold

`order-create-page.tsx` owns its `useForm` + zod schema and hands them to `resource-form-page`, the same way the purchase order form does. The scaffold contributes the save semantics; the page contributes the fields, the field array, and the quote.

**Why not extend the scaffold.** The running total, the debounced quote, and the two-level product→variant picker are this page's problems, not every form's. The scaffold's whole design is that callers pass in their own form so it does not grow a prop per page.

**Why not model it on the storefront checkout.** Different job. The storefront is optimised for a shopper entering their own details once; this is optimised for an operator who is on a call, re-reading figures aloud, and may add a line mid-sentence.

### Decision 4 — Lines reuse the purchase order form's picker shape

Product `Combobox` backed by `useProducts` with a search term, plus a per-line variant picker that resolves the chosen product through `useProduct` because the admin product list omits `variants`. Quantity via `number-input`, paired with `lib/validation/numeric` so a cleared field is `undefined` rather than `0`.

The unit price is rendered as text from the resolved product or variant, purely so the operator can see it. It is display only and is **not** part of the form's submitted values — if it is not in the payload, it cannot be sent, and there is nothing to keep in sync with the server's authoritative price.

**Deliberate divergence from the purchase order form:** that form has an editable `unitCost` per line, because a supplier's price genuinely is per-purchase-order data the operator holds. A sale's price is catalog data the server holds. The two forms look similar and must not be made identical.

### Decision 5 — Validation is duplicated where it protects the operator, and only there

The zod schema enforces: at least one line; every line has a product, a variant where the product has variants, and a quantity ≥ 1; phone present; address present for a delivery option; channel chosen; discount ≥ 0 and, when above 0, a non-empty reason; discount ≤ the quoted subtotal.

Every one of these is also enforced server-side and is meant to be. The client copy exists so the operator finds out while typing rather than after a round trip — and `discount ≤ subtotal` in particular, because that refusal would otherwise arrive with the customer still on the line.

Stock is deliberately **not** pre-validated client-side. It is the one rule that can change between the form loading and the save landing, so a client check would give a false assurance; it belongs in the refusal path (Decision 6).

### Decision 6 — The refusal path is the page's primary path, not its error case

`resource-form-page` already guarantees that a refused save leaves every entered value untouched with the reason above the fields, and `request()` already throws `ApiError` carrying `errorSources[0].message` — the backend's own wording. The page's job is to not break that: no optimistic clearing, no navigation, no resetting the field array, and no re-mounting the form on error.

The specific refusal to get right is insufficient stock, because it is the likely one and it names a line. The backend's message names the short line; it is shown verbatim rather than paraphrased.

### Decision 7 — One idempotency key per order attempt, regenerated only on success

The key is minted when the form mounts and held in a ref across retries, so resubmitting the same order after a failure replays rather than duplicates. It is regenerated only when an order successfully commits — which, since the page navigates away on success, means it is regenerated by the next mount.

**Why it matters more here than at checkout.** A duplicated manual order deducts stock twice and sends a second parcel to a customer who ordered one, with nobody at the other end to notice a duplicate confirmation.

### Decision 8 — `Thumb` is promoted to `components/ui/thumbnail.tsx` before the order surfaces use it

Moved, not copied, with `media-sidebar.tsx` updated to import it. The behaviour it already has is exactly what the order surfaces need — a fixed box, `object-cover`, a placeholder for no URL, and an `onError` fallback to the same placeholder — and it is the `onError` path that decides whether a table reflows when one line's image 404s.

**Why now rather than inline `<img>` on each order surface.** Three copies of a broken-image fallback is three chances to get the row height wrong, and the orders list already renders one line per item inside a table cell, where a reflow is most visible.

`productsListPage` uses a bare `<img src={row.original.images[0]?.url}>` with no fallback at all. Converting it is **not** in this change's scope — it is a real inconsistency, worth a follow-up, and folding an unrelated page into this one is how a change stops being reviewable.

### Decision 9 — The route is `/sales/orders/new`, declared above `/sales/orders/:orderId`

The panel's router matches in declaration order, and `:orderId` would otherwise capture the literal `new` and send the operator to a detail page for an order that does not exist. This is the same load-bearing ordering the server's route file documents, and `/inventory/purchase-orders/new` already sits above `/inventory/purchase-orders/:poId` for the same reason.

Lazy-loaded like every other route, and behind `RequireRole` for the roles the backend permits — the panel's check is UX; the backend re-checks.

### Decision 10 — The delivery `Select` mounts only after store settings have loaded

`useStoreSettings` supplies the delivery options. A Radix `Select` mounted before its data arrives clears react-hook-form's `values` reset — the trap CLAUDE.md records and the panel has already been bitten by. On a *create* page there is no record to reset from, so the failure mode is subtler than on an edit page: the select renders empty and the operator cannot choose, or a default written into the form is silently dropped. The delivery section renders a skeleton until the options are in hand.

A store with **no** configured delivery options is a real state — `store-settings.ts` documents that an unconfigured shop genuinely has `options: []`. The page says so and links to the setting rather than presenting an empty dropdown.

### Decision 11 — Channel is a column and a filter, not a badge on the status column

A separate compact column, and a `channel` param on `useOrders` sent to the backend alongside `status`. Filtering happens server-side, like every other list filter in the panel — `QueryBuilder` owns filtering and sorting, and a client-side filter over the current page would silently mean "WhatsApp orders on page 3 of 12".

Crowding it into the status badge would conflate two independent axes, and the operator filters by them together.

## Risks / Trade-offs

**The quote round trip makes the form feel laggy** → Debounced, with the previous figure held and marked as updating rather than blanked. If it proves slow in practice the mitigation is quoting on blur rather than on keystroke, not computing locally.

**Blocked entirely on the server change** → Stated in Decision 2 and in the proposal's Impact, so it is visible before work starts rather than discovered at integration. The image half of this change is *not* blocked in the same way: it only needs `items[].image`, which is the smallest, first-shipping piece of the server change.

**An order-level discount cannot express "this one line is free"** → Inherited from the server's Decision 4 and not re-litigated here. The form's discount reason field is where "case free with phone" gets written; the money is identical and only per-line attribution is lost. The form labels the discount clearly enough that an operator does not go looking for a per-line control.

**The page will look like the purchase order form and invite copy-paste of its editable price** → Decision 4 states the divergence explicitly for exactly this reason, and the unit price being outside the form's values means a copied control would have nothing to bind to.

**Thumbnails make the orders list taller and heavier** → Small fixed box, one extra image per line on rows already fetched. The Items column already renders one text line per item, so the row count does not change — only its height. If a 100-row page with large baskets proves heavy, the mitigation is a smaller default page size, not dropping the images.

**Store settings with no delivery options block the form** → Handled explicitly in Decision 10 with a message and a link to the setting, rather than an empty dropdown the operator cannot get past.

## Migration Plan

No data migration; this is UI over an already-migrated API.

1. Ship the image half first — `OrderLineItem.image`, the shared `Thumbnail`, the two order surfaces. It depends only on the server's task group 1 and delivers value on its own.
2. Ship the channel column and filter once the server's schema tasks land.
3. Ship `order-create-page.tsx` last, once `POST /orders/manual` and the staff quote are live.
4. **Rollback**: each of the three is independently revertible. The create page's route can be removed without touching the list or detail changes.

## Open Questions

- Whether the form should offer collection (`PICKUP`) delivery options. The endpoint accepts either, so this is purely which options the select lists. Carried from the server change's open question; it changes no spec, schema or task here, only a filter on an already-existing list.
