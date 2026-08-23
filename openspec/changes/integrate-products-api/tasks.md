## 1. API layer (`src/lib/api/products.ts`)

- [x] 1.1 Reshape `Product`/`ProductInput`: replace `categoryIds`/`isPublished`/`images: string[]` with `categoryId`, `status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'`, `type: 'SIMPLE' | 'VARIABLE'`, `shortDescription`, `isFeatured`, `images: { id?, url, altText?, sortOrder, isPrimary }[]`; add `variants?: { id?, name, sku, price, stockQuantity, attributes: Record<string, string> }[]` and `attributes?: { id?, name, value }[]`. `Product` (read) additionally embeds `category`/`brand` as objects (list: primary image only; detail: full `images[]`/`variants[]`/`attributes[]`).
- [x] 1.2 Add the shared `ApiEnvelope<T>` type and `request<T>()` fetch helper (or import/reuse the one from `categories.ts` if it's promoted to a shared module) using `BASE_URL`, `credentials: 'include'`, `Content-Type: application/json`, throwing `ApiError` on `!res.ok || !json?.success`.
- [x] 1.3 Implement `listProducts` against `GET /products/admin` with `page`, `limit`, `searchTerm` (renamed from the mock's `search`, matching `categories.ts`'s convention), `categoryId`, `brandId`, `status`, `type`, `isFeatured` query params.
- [x] 1.4 Implement `getProduct` against `GET /products/admin/:id`.
- [x] 1.5 Implement `createProduct` against `POST /products` sending the full `ProductInput`.
- [x] 1.6 Implement `updateProduct` against `PATCH /products/:id` sending the full `ProductInput` (no client-side diffing, per [[keep-api-implementation-simple]]) — one endpoint handles scalar fields and the nested `variants`/`images`/`attributes` sync together, no separate call needed.
- [x] 1.7 Implement `deleteProduct` against `DELETE /products/:id`.
- [x] 1.8 Remove the now-unused mock scaffolding: `SEED_CATEGORIES`, `SEED_BRANDS`, `seedProducts`, `_getProductById`, `_adjustProductStock`, `toggleProductCategory`/`useToggleProductCategory` (confirmed zero other callers). Keep `_getAllProducts()` exported but reimplement it as a lazily-populated cache (fetch real products once in the background on first use, cache in memory, function returns the cache synchronously — `[]` before the first fetch resolves). It still has 5 external callers (`orders.ts`, `dashboard.ts`, `reviews.ts`, `purchase-orders.ts`, `stock.ts`) that this change deliberately does not fix — see design.md Decision 7; each is migrated off it in its own upcoming roadmap change. Also had to guard `orders.ts`'s `seed()` and `reviews.ts`'s `seedReviews()` (both index into `_getAllProducts()` with `%` at module-load time) against an empty cache — without the guard, `i % 0` produces `NaN`, `products[NaN]` is `undefined`, and `.id` on it throws synchronously during module evaluation, crashing the whole app on load, not just those features. `purchase-orders.ts`'s `seed()` and `stock.ts`'s `seedStock()` already had equivalent guards / used safe iteration and needed no change. Also fixed two now-mistyped fields surfaced by the reshape: `orders.ts`'s `buildOrder()` was assigning `p.sku` (now `string | null`) directly to `OrderLineItem.sku: string` and `p.price` (now a `string`, see design.md's Decimal note) directly to `unitPrice: number`.
- [x] 1.9 Drop the local `brandNames()`/`categoryNames()` lookup helpers — the real list/detail responses already embed `category`/`brand` as full objects, no local join needed.

## 2. Product form (`product-form-page.tsx`)

- [x] 2.1 Rewrite the zod schema: `name`, `sku`, `shortDescription`, `description`, `type`, `status`, `categoryId`, `brandId`, `price`, `compareAtPrice`, `stockQuantity`, `lowStockThreshold`, `isFeatured`, `images` (array), `attributes` (array), `variants` (array, optional at schema level).
- [x] 2.2 Add a `superRefine` (or equivalent) requiring at least one `variants` row when `type === 'VARIABLE'`.
- [x] 2.3 Replace the category checkbox list with a single `Select` bound to `categoryId`.
- [x] 2.4 Replace the `isPublished` `Switch` with a `status` `Select` (Draft/Active/Archived).
- [x] 2.5 Add `type` `Select` (Simple/Variable) and `isFeatured` `Switch`.
- [x] 2.6 Add `shortDescription` input alongside the existing `description` textarea.
- [x] 2.7 Replace the "image URLs, one per line" textarea with a repeatable image row editor (`useFieldArray`): url input, alt text input, primary radio-per-row (selecting one clears `isPrimary` on the others), delete button, "Add image" button — following `purchase-order-form-page.tsx`'s row-editor layout.
- [x] 2.8 Add a repeatable attributes row editor (`useFieldArray`): name input, value input, delete button, "Add attribute" button.
- [x] 2.9 Add a Variants card, rendered only when `type === 'VARIABLE'`: repeatable rows (`useFieldArray`) for name, SKU, price, stock quantity, each with its own nested repeatable attribute name/value editor (one `useFieldArray` per variant index) and a delete button; "Add variant" button in the card header.
- [x] 2.10 Update `onSubmit` to build the new `ProductInput` shape (derive each image's `sortOrder` from row index at submit time; drop the old images-string-splitting logic).
- [x] 2.11 Update the `values`/`defaultValues` mapping (edit mode prefill, create-mode defaults) for every new/renamed field — in edit mode, each image/variant/attribute row's `id` from the loaded product must be carried into the field array's row state (kept out of the visible UI) so submit round-trips it and the backend updates rather than delete-and-recreates that row.

## 3. Product detail and list pages

- [x] 3.1 Update `product-detail-page.tsx` to render `type`, `status` (badge), `isFeatured` (badge), `shortDescription`, the images gallery with the primary image distinguished, the attributes list, and — when `type === 'VARIABLE'` — a variants table (name, SKU, price, stock, attributes).
- [x] 3.2 Update `products-list-page.tsx`'s filters and columns: replace any `isPublished`/`categoryIds` usage with `status`/`categoryId`.

## 4. Verification

- [ ] 4.1 Create a Simple product end to end (images + attributes, no variants) and confirm it appears correctly in list and detail views. **Not done** — no backend instance was available in this environment to create real data against; needs a live backend.
- [ ] 4.2 Create a Variable product end to end (images + attributes + 2+ variants with their own attributes) and confirm the variants render correctly on the detail page. **Not done**, same reason as 4.1.
- [ ] 4.3 Edit an existing product's images/attributes/variants and confirm the update round-trips correctly. **Not done**, same reason as 4.1.
- [x] 4.4 Confirm `purchase-order-form-page.tsx`'s product picker (`useProducts`) still compiles and works against the reshaped `Product` type. (`tsc -b` and `eslint .` both clean.)
- [x] 4.5 Run typecheck/lint/build to catch any remaining references to removed fields (`isPublished`, `categoryIds`, old `images: string[]`). `tsc -b --noEmit`, `eslint .`, and `vite build` all pass clean.
- [x] 4.6 (added) Runtime smoke check with no backend running: launched the dev server, faked an authenticated session, and navigated Products (list/new), Dashboard, Orders, Reviews, Purchase Orders, and Stock with Playwright. All five pages that read the `_getAllProducts()` compat shim rendered without a JS crash (no uncaught `pageerror`s anywhere) — only the expected CORS/network console errors from the real API calls failing (no backend running), confirming the `orders.ts`/`reviews.ts` empty-cache guards (task 1.8) actually prevent the crash they were written for, not just in theory. The new product form rendered all sections correctly (screenshot-verified). This is not a substitute for 4.1–4.3 against a live backend.
