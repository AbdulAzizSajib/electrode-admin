## Context

See `proposal.md` - Why/What Changes for motivation and the full field-level diff. Relevant current state:

- `src/lib/api/products.ts` is entirely mock/in-memory (`seedProducts`, module-level `products` array) — no `fetch`, no `BASE_URL` usage.
- `src/lib/api/categories.ts` and `src/lib/api/brands.ts` already made the identical mock → real swap and establish the pattern to follow: a shared `request<T>()` helper wrapping `fetch` with `credentials: 'include'`, an `ApiEnvelope<T>` (`{ success, message, data, meta? }`), and `ApiError` thrown on `!res.ok || !json?.success`.
- `product-form-page.tsx` uses `react-hook-form` + `zodResolver`, shadcn `Form`/`FormField` primitives, and single-level cards per section — same as `purchase-order-form-page.tsx`.
- `purchase-order-form-page.tsx` is the only existing form with a repeatable row editor, built with `useFieldArray` (`fields`/`append`/`remove`), each row a bordered `div` with a trailing delete `Button`. This change reuses that pattern for images, attributes, and variants rather than introducing a new pattern.
- Per user preference ([[keep-api-implementation-simple]]), `updateProduct` sends the full form payload on every save — no client-side diffing of changed fields, matching how `updateCategory`/`updateBrand` already work.
- Confirmed directly against the backend source (`server/prisma/schema/product.prisma`, `server/src/app/module/product/*`), not just the sample payload:
  - Endpoints: `POST /products`, `GET /products/admin` (list), `GET /products/admin/:id` (detail), `PATCH /products/:id` (update — one endpoint for both scalar fields and nested variants/images/attributes, not two), `DELETE /products/:id`.
  - `status` is `'DRAFT' | 'ACTIVE' | 'ARCHIVED'` (`ProductStatus` enum) — three values, not two.
  - Admin list/detail query filters: `searchTerm` (not `search`), `status`, `type`, `categoryId`, `brandId`, `isFeatured`, `page`, `limit`, `sortBy` — same `searchTerm` convention `categories.ts` already uses.
  - List response (`GET /products/admin`) embeds `category`/`brand` as full nested objects and only the primary `image` (not the full images array or variants/attributes) — no separate category/brand name lookup needed for the list page.
  - Detail response (`GET /products/admin/:id`) embeds full `images[]`, `variants[]`, `attributes[]`, plus `category`/`brand` objects and supplementary `categories[]` tags (the `ProductCategory` many-to-many — out of scope for this change, see Non-Goals).
  - Update reconciles `variants`/`images`/`attributes` by `id`: a row with `id` is updated, a row without one is created, and any existing row not present in the payload is deleted. The form must carry each row's `id` from the loaded product through to submit — see Decision 3.
  - `price`/`compareAtPrice`/`costPrice` (product and variant) are Prisma `Decimal` columns, which serialize to **strings** in the JSON response (`Decimal.prototype.toJSON` — a well-known Prisma behavior, not a bug), not numbers. `Product`/`ProductVariant`'s read types must type these as `string`; the form's `zod` schema already uses `z.coerce.number()` for its own fields, so prefilling from a loaded product just passes the string through (coerced on blur/submit) same as it does for a typed number today. `ProductInput` (the request body) keeps them as `number` — only the response shape is a string.
- `_getAllProducts()` (the synchronous mock getter `products.ts` currently exports) has five other still-mock consumers (`orders.ts`, `dashboard.ts`, `reviews.ts`, `purchase-orders.ts`, `stock.ts`) that read it both at module-load time (seeding) and per-request. Per the agreed roadmap (`integrate-inventory-api` → `integrate-orders-api` → `integrate-post-purchase-api` → dashboard, each landing shortly after this one), those five modules get migrated off it in their own changes rather than here — see Decision 7.

## Goals / Non-Goals

**Goals:**
- `src/lib/api/products.ts` talks to the real backend with the same envelope/error handling as `categories.ts`/`brands.ts`.
- `product-form-page.tsx` collects exactly the fields the real `POST /products` payload expects, including nested images, attributes, and (conditionally) variants with their own attributes.
- Existing consumers of `useProducts()`/`Product` (`purchase-order-form-page.tsx`, `products-list-page.tsx`, `product-detail-page.tsx`) keep working against the richer type.

**Non-Goals:**
- No image upload/file picker — images stay URL-based (matches the sample payload's `url` field), same as categories/brands.
- No backend-side validation logic is reimplemented client-side beyond basic required-field/shape checks; the backend remains the source of truth for business rules (e.g. SKU uniqueness).
- No change to how purchase orders reference products (`productId` line items) — only the `Product` shape they read from gains fields.

## Decisions

**1. `categoryId` single-select replaces the `categoryIds` checkbox list.**
The payload takes one `categoryId`. Swap the current scrollable checkbox list for a single shadcn `Select`, same component already used for `brandId`. Alternative considered: keep multi-select and send `categoryIds[0]` — rejected, it would silently drop data the user thinks they set.

**2. `status` enum (`DRAFT` | `ACTIVE` | `ARCHIVED`) replaces the `isPublished` boolean.**
Rendered as a `Select` (not a `Switch`) since it's a named enum, not a binary flag, and mirrors how `product-detail-page.tsx` and `products-list-page.tsx` will need to render a status badge/filter rather than a published/unpublished dot. Confirmed against `ProductStatus` in the backend's Prisma schema.

**3. Images, attributes, and variant-attributes all reuse the same "repeatable row via `useFieldArray`" shape**, styled like `purchase-order-form-page.tsx`'s line-item editor (bordered row, trailing delete icon button, an "Add" button in the card header). This keeps the new form visually and structurally consistent with the one existing multi-row form instead of inventing a second pattern (e.g. a modal-based row editor).
- Images: `{ id?, url, altText, isPrimary, sortOrder }[]`. `sortOrder` is derived from row position at submit time (not a user-facing field); `isPrimary` is a single-select radio-per-row (choosing one clears the others) so exactly one row is primary, satisfying the spec's "Add product images" scenario.
- Attributes: `{ id?, name, value }[]`, plain two-column rows.
- Variant attributes: same `{ name, value }[]` shape (no `id` — these live inside the variant's own `attributes: Record<string,string>` JSON blob, not a separate id-tracked child collection), nested one level inside each variant row (a `useFieldArray` per variant index) — the same free-form key/value idea as top-level attributes, just scoped to a variant (e.g. storage, color).
- Every image/attribute/variant row's `id` (present when it came from a loaded product, absent for a row the user just added) rides along in the row's form state, hidden from the UI, and is sent back as-is on submit — this is what makes the backend's id-based reconcile (Context) update existing rows instead of deleting and recreating them.

**4. Variants section is conditionally rendered, not conditionally mounted in the schema.**
The zod schema always includes an optional `variants` array; the form only shows the Variants card and enforces "at least one variant" via `superRefine` when `type === 'VARIABLE'`. Alternative considered: two separate schemas switched by type — rejected as unnecessary complexity for one conditional array.

**5. Product-level `price`/`stockQuantity`/`compareAtPrice`/`lowStockThreshold` stay visible and required regardless of type.**
The sample payload sets these at the product level even though the product is `VARIABLE` and also carries per-variant `price`/`stockQuantity`. The form doesn't try to infer/roll these up from variants — it sends whatever the two sections independently contain, matching the payload literally rather than guessing an aggregation rule that isn't documented.

**6. Slug stays out of the form entirely** (same UX as categories). The backend field is optional and, if sent, is only used as a seed for uniqueness dedup — not a hard requirement like categories' outright rejection — but omitting it gets the same "derived from name" result either way, so there's no behavior lost by not exposing it.

**7. `_getAllProducts()`'s five other mock consumers are left broken (not bridged) until their own roadmap changes land.**
`orders.ts`, `dashboard.ts`, `reviews.ts`, `purchase-orders.ts`, and `stock.ts` all call the synchronous `_getAllProducts()` — some at module-load seeding time, some per-request (see proposal.md discussion). Converting `products.ts` to real `fetch` calls means that getter can no longer return a synchronous, complete array. Two options were weighed:
- **Chosen: keep `_getAllProducts()` exported with the same synchronous signature, backed by a lazily-populated cache** (`listProducts()` fetched once in the background, cached in memory; returns `[]` until that resolves). This keeps the five dependent modules compiling and not crashing outright — they just see empty/stale product data until each is migrated to the real API in its own change (`integrate-inventory-api` fixes `stock.ts`/`purchase-orders.ts`; `integrate-orders-api` fixes `orders.ts`; `integrate-post-purchase-api` fixes `reviews.ts`; the dashboard change fixes `dashboard.ts`).
- Rejected: fully reimplementing those five modules' product access as part of this change — that's exactly the scope the user and I agreed to split across the roadmap instead of bolting onto `integrate-products-api`.
This is a deliberate, temporary, documented degradation — not a silent scope cut — and it's why the roadmap changes are expected to follow this one in tight succession rather than with a long gap.

## Risks / Trade-offs

- **[Risk]** `variants[].attributes` and top-level `attributes` are both loosely-typed (`Record<string, string>`/`{name,value}[]`) on the backend — nothing stops a user from entering duplicate attribute names in one row set → **Mitigation**: none enforced client-side beyond non-empty name; backend is source of truth, consistent with Non-Goals.
- **[Risk]** Existing seeded mock products (`SEED_CATEGORIES`/`SEED_BRANDS`/`seedProducts()`) disappear once `products.ts` calls the real backend, so local dev needs the backend running and seeded with categories/brands/products → **Mitigation**: same trade-off already accepted for categories/brands; no new mitigation needed here.
- **[Risk]** The five modules relying on `_getAllProducts()` (Decision 7) show empty/stale product-derived data (e.g. dashboard's low-stock count, mock order line items) between this change landing and their own roadmap change landing → **Mitigation**: none beyond sequencing the roadmap changes back-to-back; acceptable for a pre-launch admin panel with no real users yet.

## Migration Plan

1. Reshape `Product`/`ProductInput` types and swap `products.ts` function bodies to real `fetch` calls (mirrors `categories.ts`/`brands.ts` structure).
2. Rebuild `product-form-page.tsx`'s schema and sections against the new shape.
3. Update `product-detail-page.tsx` and `products-list-page.tsx` for the renamed/added fields.
4. No feature flag or gradual rollout — this is a pre-launch admin panel with no external consumers of the mock shape (per proposal.md Impact), so the swap lands in one change like categories/brands did.

## Open Questions

(none — the previous open question about the `status` enum's full value set is resolved: confirmed as `DRAFT | ACTIVE | ARCHIVED` directly from the backend schema.)
