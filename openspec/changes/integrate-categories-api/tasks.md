## 1. `src/lib/api/categories.ts` — types and request helper

- [x] 1.1 Extend the `Category` interface with `image`, `banner`, `status` (boolean), `seoTitle`, `seoDescription`, `sortOrder`, `updatedAt`, and optional `parent`/`children` (nested `Category`-shaped objects on detail responses).
- [x] 1.2 Update `CategoryInput` to `{ name, description?, image?, status?, sortOrder?, parentId? }`, dropping `slug`.
- [x] 1.3 Add a local `request<T>(path, init)` helper (envelope unwrap + `ApiError` on failure), following `src/lib/api/auth.ts`'s pattern, plus an `ApiEnvelope<T>` type.
- [x] 1.4 Remove the mock in-memory `categories` array and the `_getAllCategories`/`hasChildren` helpers. (`src/lib/api/products.ts` depended on `_getAllCategories` for its own unrelated mock product seeding — per user direction, gave it its own inline `SEED_CATEGORIES` fixture instead of keeping any fake data in `categories.ts`.)

## 2. `src/lib/api/categories.ts` — real endpoint calls

- [x] 2.1 `listCategories`: call `GET /categories/admin` with `page`, `limit`, `searchTerm` (mapped from `ListParams.search`), `status`, `parentId` query params; return the `{ data, meta }` shape `PaginatedResponse<Category>` already expects (map the endpoint's `meta` field directly).
- [x] 2.2 `getCategory`: call `GET /categories/admin/:id`.
- [x] 2.3 `createCategory`: call `POST /categories` with the fields from `CategoryInput` (name required; omit undefined optional fields rather than sending them as `null`/empty).
- [x] 2.4 `updateCategory`: call `PATCH /categories/:id`. (Simplified from the original "caller diffs changed fields" plan — per user direction to keep API code easy to follow, the form now sends the same full payload shape on create and edit; see design.md Decision 4.)
- [x] 2.5 `deleteCategory`: call `DELETE /categories/:id`; let the backend's error message propagate via `ApiError` on rejection (no client-side "has children" pre-check).
- [x] 2.6 Remove now-unused mock-only imports (`delay`, `generateId`, `matchesSearch`, `paginate`, `recordAuditEntry` if no longer called, `formatSlug`) and confirm `recordAuditEntry` calls are removed or kept per whether audit logging is still desired client-side — drop them since the backend is now the source of truth for the created/updated/deleted resource.

## 3. `CategoriesPage` UI updates

- [x] 3.1 Add a `status` column (active/inactive badge) to the table.
- [x] 3.2 Confirm the search input still works end-to-end now that the outgoing query param is `searchTerm` (no UI change expected — verify via the network request). The page's search input is unchanged; `listCategories` maps it to `searchTerm` at the request layer.
- [x] 3.3 Verify the delete-confirmation flow shows the backend's actual error message when a delete is rejected (update the static "Categories with children cannot be deleted" description copy in `ConfirmDialog` if it no longer matches confirmed backend behavior). The existing catch block already surfaces `err.message` from `ApiError`; softened the static dialog copy since the "has children" claim was mock-specific and unconfirmed for the real backend.

## 4. Category form modal UI updates

- [x] 4.1 Remove the "Slug" form field and its schema entry.
- [x] 4.2 Add "Status" (active/inactive) and "Sort order" (number) form fields; submit builds one plain payload from current form values, sent as-is on both create and edit (no diffing — see design.md Decision 4).
- [x] 4.3 Add an "Image URL" form field wired to `CategoryInput.image`.

## 5. Verification

- [ ] 5.1 Manually create a top-level category and a child category against a running backend; confirm both appear correctly nested in the list.
- [ ] 5.2 Manually edit a category's description/sort order only; confirm other fields are unchanged after refetch.
- [ ] 5.3 Manually delete a category and confirm list/table update; if the backend rejects a delete, confirm the shown error matches the backend's message.
- [x] 5.4 Run `pnpm build` (or the project's typecheck script) to confirm no type errors from the `Category`/`CategoryInput` changes ripple into other files. `tsc --noEmit` and `pnpm build` both pass clean.

## 6. Follow-up (post-implementation feedback)

- [x] 6.1 Fix bug: creating a top-level category (no parent) failed while creating a child category worked. Cause: the form sent `parentId: null` explicitly; the backend's sample request for a top-level category omits the key entirely and the backend rejects `null`. Fixed by omitting `parentId` from the payload when no parent is selected, on both create and edit. See design.md Decision 3 update.
- [x] 6.2 Replace the side-sheet category form with an antd `Modal` + `Form` (`category-form-modal.tsx`, replacing `category-form-sheet.tsx`), at the user's direction to pilot Ant Design on the Categories page as the template for future pages. Installed `antd`; added a shared `antdTheme` (`src/lib/antd-theme.ts`) applied once via `<ConfigProvider>` in `main.tsx` so its color tokens match the existing design tokens. Per user decision: the categories table stays on the existing `DataTable`, and toast notifications stay on `react-hot-toast` — only the create/edit modal and its form fields moved to antd for now.
