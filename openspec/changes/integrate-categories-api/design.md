## Context

`src/lib/api/categories.ts` is a mock module written to `src/lib/api/client.ts`'s conventions (`ApiError`, `PaginatedResponse`, `ListParams`) exactly so it could later be swapped for real `fetch` calls without touching call sites — see proposal.md and `build-admin-panel/design.md` Decision 6. `src/lib/api/auth.ts` already did this swap for auth and established a concrete pattern: a local `request<T>()` helper that hits `BASE_URL`, sends `credentials: 'include'`, unwraps a `{ success, message, data }` envelope, and throws `ApiError` with the server's message on failure. The category endpoints (documented in proposal.md) return that same envelope shape.

The category API also splits list/detail reads across two paths: `GET /categories/admin` (list, admin-only filters: `status`, `parentId`, `searchTerm`) and `GET /categories/admin/:id` (detail, includes nested `parent`/`children`), while writes use plain `/categories` (`POST`, `PATCH /:id`, `DELETE /:id`).

## Goals / Non-Goals

**Goals:**
- Match the real endpoints' request/response shapes exactly (field names, which fields are optional, which endpoint each operation uses).
- Keep `useCategories`/`useCategory`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory` hook signatures and `queryKeys.categories.*` unchanged so no other feature file needs to change.
- Keep the category-list `search` UI param name as-is at the call-site/hook level; only the outgoing query string key changes to `searchTerm`.

**Non-Goals:**
- Image upload — `image`/`banner` are plain URL strings in the payload (per the sample requests); building a file-upload flow is out of scope.
- Reordering UI (drag-and-drop) for `sortOrder` — the form will expose it as a plain number field.
- Changing any other mock resource module (brands, products, etc.).

## Decisions

### 1. One local `request<T>()` helper in `categories.ts`, returning the full envelope
A single small `request<T>(path, init)` helper (fetch + `ApiError` throw on failure) lives in `categories.ts`, rather than extracting a shared helper into `client.ts` right now. Unlike `auth.ts`'s version, it returns the whole `{ success, message, data, meta }` envelope instead of unwrapping straight to `data` — every call site just does `res.data` (and `res.meta` for the one list call that needs it). One function, no second "unwrap" layer, at the user's explicit request to keep this module's code easy to follow.
**Why**: `client.ts`'s docstring frames it as the *mock*-layer's shared contract; every other resource module still depends on its mock-only helpers (`delay`, `paginate`, `generateId`, `matchesSearch`). Moving `request<T>()` there now would blur that boundary for a one-module change.
**Alternative considered**: extract `request<T>()` into `client.ts` immediately. Rejected for this change — worth doing once a second mock module migrates to real HTTP, so the shared helper's shape is informed by more than one real integration. Left as an explicit follow-up in Open Questions.

### 2. `listCategories` calls `/categories/admin`, not `/categories`
The admin list endpoint is the one documented with pagination, `searchTerm`, `status`, and `parentId` filters and is what the admin panel's table needs.
**Why**: matches the given Postman examples exactly; the plain `/categories` path isn't documented here and may be a public/storefront-facing route with different filtering or shape.

### 3. `Category` type gains new fields as optional-safe, not a breaking rewrite of consumers
Add `image`, `banner`, `status`, `seoTitle`, `seoDescription`, `sortOrder`, `updatedAt` to `Category`, and `parent`/`children` as optional nested fields present only on detail responses. `CategoryInput` gains `image?`, `status?`, `sortOrder?` and drops `slug` (server-generated). `parentId?` is a plain `string` (no `null`) — see the note below.
**Why**: matches the real response bodies field-for-field; keeping `parent`/`children` optional (rather than a separate `CategoryDetail` type) avoids a second type for the one screen (edit sheet) that might use detail data, while the list screen keeps deriving parent name locally as it does today.
**Alternative considered**: fetch category detail (with nested `children`) to reimplement the "prevent delete if has children" check the mock enforced client-side. Rejected — the real API's delete-rejection behavior for categories with children is not confirmed by the given examples; the client will surface whatever error the backend returns (see spec.md "Backend rejects the delete") instead of re-implementing a guess at that rule client-side.
**Confirmed post-implementation**: the initial version sent `parentId: null` for top-level categories (reasoning it was equivalent to omitting the key). It isn't — the backend rejected it, so creating a top-level category failed while creating a child category (a real id) worked. Fixed by omitting `parentId` from the request body entirely when no parent is selected, matching the sample request exactly; `CategoryInput.parentId` was narrowed from `string | null` to plain `string` accordingly.

### 4. `updateCategory` sends the full edit-form payload, not a computed diff
The form's `onSubmit` builds one plain payload object (name, description, image, status, sortOrder, parentId) from the current form values and sends it as-is on both create and edit — no diffing against the previously loaded category.
**Why**: simpler to read and matches every other form in this codebase (e.g. `warehouses-page.tsx`, `shipping-methods-page.tsx`), at the user's explicit request to keep API-layer code easy to follow. Safe in practice: the edit form is pre-filled with the category's current values (via `useForm`'s `values` option), so untouched fields round-trip unchanged; the only fields this form doesn't expose at all (`seoTitle`, `seoDescription`, `banner`) are simply absent from `CategoryInput` and never sent, so `PATCH` can't clobber them.
**Alternative considered**: diff changed fields only and send a `Partial<CategoryInput>` on edit. Implemented first, then reverted — correct but added a `buildPayload` branch (create vs. edit, field-by-field comparisons) that wasn't proportional to the risk it guarded against, given the pre-fill behavior above.

### 5. Form changes: drop "Slug" field, add "Status" and "Sort order" fields
The category form removes the Slug input (server-generated on create, never accepted in the create payload) and adds a Status toggle/select (active/inactive) and a Sort order number input.
**Why**: keeps the form limited to fields the API actually accepts; a slug input that's silently ignored on submit would be misleading.

### 6. Category form rebuilt as an antd `Modal` + `Form`, replacing the shadcn/Radix `Sheet` — piloting Ant Design
Post-implementation, the user asked to move off the current shadcn/Radix design system onto Ant Design (`antd`) app-wide going forward, starting with Categories. `category-form-sheet.tsx` (react-hook-form + zod + shadcn `Sheet`/`Form`/`Input`/etc.) was replaced by `category-form-modal.tsx` using antd's own `Form` (antd's built-in validation, not zod) inside an antd `Modal`. A single `antdTheme` (`src/lib/antd-theme.ts`) is applied once via `<ConfigProvider>` in `main.tsx`, mapping antd's theme tokens (`colorPrimary`, `colorError`, `colorSuccess`, `borderRadius`, `fontFamily`) to this project's existing design tokens, so any future antd component picks up consistent theming without per-page setup.
**Why**: antd's `Form` is the idiomatic pairing for antd `Modal`/`Input`/`Select`/etc.; mixing react-hook-form's `Controller` pattern with antd's `Form.Item` context would fight both libraries instead of adopting either cleanly.
**Scope, per explicit user decision**: only the create/edit modal and its fields moved to antd. The categories list keeps the existing `DataTable` (tanstack-table + shadcn styling), and toast notifications stay on `react-hot-toast` — neither is part of this pilot. Rolling antd out to other pages/the table/notifications is future work, not part of this change.

## Risks / Trade-offs

- **[No confirmed "has children" delete-rejection example]** The real API's behavior when deleting a category with children is unverified from the given samples (unlike the removed mock, which hard-coded a 409). **Mitigation**: surface the backend's actual error message (Decision 3's alternative-considered note); revisit copy once the real rejection response is observed.
- **[`request<T>()` duplicated between `auth.ts` and `categories.ts`]** Small duplication until a shared helper is justified. **Mitigation**: tracked as an Open Question below; low cost at two call sites.
- **[Full-payload `PATCH` re-sends unchanged fields]** Editing one field re-sends every form field's current value, not just the change. **Mitigation**: harmless given the edit form is pre-filled from the loaded category (Decision 4); acceptable trade-off for simpler code.
- **[Two UI/form libraries now live side by side on this one page]** The Categories page mixes antd (modal/form) with shadcn/Radix (table, buttons, dropdown, confirm dialog) and react-hook-form/zod (every other page's forms) until more pages migrate. **Mitigation**: accepted as the expected, temporary state of an in-progress pilot; `antdTheme` keeps the visual seams as small as possible in the meantime.
- **[antd bundle size]** The `categories-page` chunk grew from ~7KB to ~350KB (gzip ~112KB) pulling in antd. **Mitigation**: not addressed in this change; worth revisiting (e.g. `antd`'s documented tree-shaking/babel-plugin-import setup) once more pages adopt antd and the shared cost is spread across them.

## Open Questions

- Once a second mock module (e.g. brands) migrates to real HTTP, should `request<T>()` move into `client.ts` as a shared helper? Deferred until then so its shape reflects more than one real integration.
- What's the rollout order/timeline for moving the rest of the app (other pages, the shared `DataTable`, toast notifications) onto Ant Design? Not decided — Categories is the first pilot; the user said "everything" eventually but only asked for Categories now.
