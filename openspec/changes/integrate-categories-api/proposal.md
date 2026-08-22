## Why

The Categories admin page (`src/features/catalog/categories/`) currently reads/writes an in-memory mock array in `src/lib/api/categories.ts`. The real backend's category endpoints (list/create/update/delete, including parent/child hierarchy) are now available and documented, so this change swaps the mock implementation for real HTTP calls — the swap `design.md` Decision 6 of `build-admin-panel` anticipated — without changing the page/form components or their React Query hook shapes.

## What Changes

- Replace every function body in `src/lib/api/categories.ts` (`listCategories`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory`) with real `fetch` calls against the backend, following the `request<T>()` envelope pattern already established in `src/lib/api/auth.ts` (`{ success, message, data }`, `credentials: 'include'`, throws `ApiError` on failure).
- **BREAKING** (internal only, no external consumers): extend the `Category` type with fields the real API returns that the mock never had — `image`, `banner`, `status` (boolean), `seoTitle`, `seoDescription`, `sortOrder`, `updatedAt`, and optional nested `parent`/`children` objects on detail responses.
- `listCategories` calls `GET /categories/admin` with `page`, `limit`, `searchTerm` (renamed from the mock's `search`), `status`, and `parentId` query params, matching the real endpoint's filter names.
- `getCategory` calls `GET /categories/admin/:id`, which returns nested `parent` and `children`.
- `createCategory` calls `POST /categories` with `{ name, description?, image?, status?, sortOrder?, parentId? }`; the server derives `slug` (no client-supplied slug).
- `updateCategory` calls `PATCH /categories/:id` with a partial body (only changed fields), matching the sample payload that updates just `description` and `sortOrder`.
- `deleteCategory` calls `DELETE /categories/:id`.
- Update `CategoryFormSheet` to drop the client-side "Slug" field (server-generated, not accepted on create) and add `status` (active/inactive) and `sortOrder` inputs so the create/edit form can set the fields the real API expects.
- Update `CategoriesPage`'s table/columns for the renamed/added fields (e.g. a `status` column) as needed to keep the UI consistent with the real data shape.

No change to `src/lib/api/brands.ts`, `src/lib/api/products.ts`, or any other mock resource module — this change is scoped to categories only.

## Capabilities

### New Capabilities
- `catalog-management`: `openspec/specs/` has no capability specs yet (the earlier `build-admin-panel` change that first described catalog/category UI behavior was never archived), so this change adds the capability fresh, scoped to the category API contract — list/create/edit/delete backed by the real endpoints, including admin-list filters and partial-update semantics. The capability id mirrors `build-admin-panel`'s naming so a future archive of that change's broader (product/brand) requirements lands in the same file.

### Modified Capabilities
(none)

## Impact

- **Code**: `src/lib/api/categories.ts` (mock → real fetch), `src/features/catalog/categories/categories-page.tsx`, `src/features/catalog/categories/category-form-sheet.tsx`.
- **Backend dependency**: `{{base_url}}/categories` and `{{base_url}}/categories/admin` endpoints must be reachable from the admin app's configured `BASE_URL` (`src/lib/api/client.ts`).
- **No API surface change for other modules**: `queryKeys.categories.*` and the `useCategories`/`useCategory`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory` hook signatures are unchanged, so any other feature importing them is unaffected.

**Post-implementation update** (see design.md Decisions 3 and 6, tasks.md section 6): `category-form-sheet.tsx` was replaced by `category-form-modal.tsx` — the user redirected mid-implementation to pilot Ant Design (`antd`) on this page's create/edit modal instead of the shadcn `Sheet`, as the template for migrating the rest of the app later. A `parentId: null` vs. "omit the key" bug found during that rework (top-level category creation failed; child creation worked) was also fixed.
