## Why

The Products admin pages (`src/features/catalog/products/`) still read/write `src/lib/api/products.ts`'s in-memory mock, and the create/edit form (`product-form-page.tsx`) collects a shape that no longer matches the real backend's product endpoints — multi-select `categoryIds` vs. a single `categoryId`, a boolean `isPublished` vs. a `status` enum, newline-separated image URLs vs. structured image objects, and no support at all for product `type` (simple vs. variable), `variants`, custom `attributes`, `shortDescription`, or `isFeatured`. Categories and Brands already made this same mock-to-real swap (`integrate-categories-api`); Products is next, and the field mismatch means the form needs a redesign at the same time, not just a fetch swap.

## What Changes

- Replace every function body in `src/lib/api/products.ts` (`listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`) with real `fetch` calls against the backend, following the `request<T>()` envelope pattern established in `categories.ts`/`brands.ts` (`{ success, message, data }`, `credentials: 'include'`, throws `ApiError` on failure).
- **BREAKING** (internal only, no external consumers): reshape `Product`/`ProductInput`:
  - `categoryIds: string[]` → `categoryId: string` (single category per product).
  - `isPublished: boolean` → `status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'` (confirmed against the backend's `ProductStatus` enum and `product.validation.ts`, not just the sample payload).
  - `images: string[]` → `images: { id?: string; url: string; altText?: string; sortOrder: number; isPrimary: boolean }[]`.
  - Add `type: 'SIMPLE' | 'VARIABLE'`, `shortDescription`, `isFeatured: boolean`.
  - Add `variants?: { id?: string; name: string; sku: string; price: number; stockQuantity: number; attributes: Record<string, string> }[]` — only meaningful (and required, at least one row) when `type` is `VARIABLE`.
  - Add `attributes?: { id?: string; name: string; value: string }[]` — free-form product spec rows (e.g. Brand, Warranty), independent of variant `attributes`.
  - Each image/variant/attribute row carries an optional `id`: the backend's single `PATCH /products/:id` reconciles nested collections by `id` — rows with an `id` are updated, rows without one are created, and existing rows *not* present in the payload are deleted. The form must round-trip each row's `id` from the loaded product, not just its values.
  - `slug` stays out of the form. The backend field is technically optional-and-accepted (not rejected like categories), but omitting it makes the backend derive it from `name` — same effective UX as categories, so there's no reason to expose a slug input.
- Redesign `product-form-page.tsx` to collect the new shape:
  - General: name, SKU, short description, full description.
  - Organization: single category select (replacing the checkbox list), brand select, product type select, status select, featured switch.
  - Pricing & inventory: price, compare-at price, stock quantity, low-stock threshold (kept at the product level regardless of type, matching the sample payload which sets these even on a `VARIABLE` product).
  - Images: a repeatable row editor (url, alt text, primary toggle) via `useFieldArray`, following the line-item pattern already used in `purchase-order-form-page.tsx`, instead of the current "one URL per line" textarea.
  - Attributes: a repeatable name/value row editor via `useFieldArray`.
  - Variants: shown only when type is `VARIABLE`; a repeatable row editor (name, SKU, price, stock quantity) where each row also has its own repeatable attribute name/value pairs (e.g. storage, color); at least one variant required for `VARIABLE` products.
- Update `product-detail-page.tsx` to render the new fields (type, status, featured badge, image gallery with primary marker, attributes list, variants table) instead of the retired `isPublished`/`categoryIds`/plain image list.
- Update `products-list-page.tsx`'s filters/columns for the renamed fields (`status` instead of `isPublished`, single category instead of multi).

No change to `src/lib/api/categories.ts` or `src/lib/api/brands.ts` — this change is scoped to products only. `purchase-order-form-page.tsx`'s `useProducts()` usage (product picker for line items) keeps working since the hook signature is unchanged, only the underlying `Product` shape gains fields.

## Capabilities

### New Capabilities
- `catalog-management`: `openspec/specs/` has no capability specs yet (the `integrate-categories-api` change that first added this capability was never archived), so this change adds it fresh, scoped to the product API contract — list/create/edit/delete backed by the real endpoints, product type/variants, structured images, and custom attributes. The capability id matches `integrate-categories-api`'s so a future archive lands both category and product requirements in the same file.

### Modified Capabilities
(none — `catalog-management` doesn't exist under `openspec/specs/` yet, so product requirements are added, not modified)

## Impact

- **Code**: `src/lib/api/products.ts` (mock → real fetch), `src/features/catalog/products/product-form-page.tsx`, `src/features/catalog/products/product-detail-page.tsx`, `src/features/catalog/products/products-list-page.tsx`.
- **Backend dependency**: `{{base_url}}/products` endpoints must be reachable from the admin app's configured `BASE_URL` (`src/lib/api/client.ts`).
- **No API surface change for other modules**: `queryKeys.products.*` and the `useProducts`/`useProduct`/`useCreateProduct`/`useUpdateProduct`/`useDeleteProduct` hook signatures are unchanged, so `purchase-order-form-page.tsx` and any other feature importing them keeps working, aside from picking up the richer `Product` type.
