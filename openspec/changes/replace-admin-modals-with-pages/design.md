## Context

See proposal.md — Why. Two facts about the current code shape the whole approach.

**There are two form stacks in this panel, not one.** `components/crud/resource-form-page.tsx` — the shell the seven already-paged resources use — is built on antd `Form`. Of the eleven overlays being moved, three are antd (brands' three modals, categories' two) and eight are react-hook-form + zod + the shadcn `Form` primitives in `components/ui/form.tsx` (suppliers, warehouses, banners, campaigns, vouchers, shipping methods, roles, staff users). The antd pilot was a deliberate step (`integrate-categories-api` — proposal, post-implementation note: antd on the category modal "as the template for migrating the rest of the app later"), but that migration has not happened, and this change is not it.

**The shared list scaffolding already expects navigation.** `ResourceListPage` takes `onCreate` and `onEdit` callbacks, and the seven paged resources already pass `() => navigate(...)`. Four of the eleven list pages in scope (sub-categories, and by extension the ones that could adopt it) use `ResourceListPage`; the rest hand-roll a `DataTable`. Either way the change at the list end is the same: replace `setSheetOpen(true)` with a `navigate()`.

## Goals / Non-Goals

**Goals:**

- One authoring model across all eighteen authored resources, with identical header, buttons, save semantics, and error placement — the behaviour `specs/admin-shell/spec.md` requires.
- Field JSX, zod schemas, and mutation calls move **verbatim** wherever possible. This change should read as a relocation, not a rewrite.
- Every list page ends up smaller: a table, its columns, and its row actions.

**Non-Goals:**

- Unifying the two form stacks. Porting eight react-hook-form forms to antd is a separate change with its own risk; doing it here would hide a modal→page migration inside a library migration and make every regression ambiguous.
- Redesigning any form's fields, validation, or layout. A field that was cramped in a sheet gets more room; it does not get rethought.
- Touching `lib/api/**`, query keys, or hook signatures.
- Adding surfaces that do not exist today (no staff-user invite page, no campaign edit page — campaigns already edit in place on their detail page).

## Decisions

### Decision 1 — Extract the page chrome; keep both form stacks behind it

Split `ResourceFormPage` in two:

- `components/crud/resource-form-layout.tsx` — everything that is not the form: the `PageHeader` with title and the Cancel / "Save and continue editing" / "Save and return" buttons, the error `Alert` above the fields, the `Card`, the loading spinner, and the load-failure state with "Back to list". It takes `saving`, `error`, and three callbacks, and renders `children`.
- `components/crud/resource-form-page.tsx` — unchanged in its public API. It now composes the layout and keeps owning the antd `Form`, the `form.submit()` / `onFinish` plumbing, and the `returnAfterSave` ref.

Then add `components/crud/resource-form-page-rhf.tsx`: the same public contract (`noun`, `listPath`, `recordId`, `record`, `isLoading`, `loadError`, `onSave`) over a react-hook-form `UseFormReturn` supplied by the caller, composing the same layout.

**Why:** the spec's consistency requirements are about what the merchant sees — the same three buttons, the same landing after save, the same error above the fields, the same form preserved on rejection. That belongs in one component. Which library binds the inputs beneath it is invisible to the merchant, and forcing one answer costs eight rewrites.

**Alternatives considered.** *(a) Port all eight to antd and use the existing `ResourceFormPage`.* This is where the codebase is heading, and it would leave one stack. Rejected for this change: eight forms × their zod schemas, `OutputValues` transforms (banners, vouchers, shipping methods all use react-hook-form's diverging input/output generics — see the comment at `banners-page.tsx:56`), and their field-level messages would all be rewritten while simultaneously moving, and a bug afterwards could not be attributed to either. It stays available as a follow-up change, and Decision 1 makes it cheaper: the follow-up deletes `resource-form-page-rhf.tsx` and converts pages one at a time, with the layout untouched. *(b) One generic component with a pluggable form adapter.* An abstraction over two form libraries that differ in how they validate, hold values, and submit — more indirection than either caller needs.

### Decision 2 — Route shape follows the resource, not a global rule

Per the answered question: a resource with no separate read-only detail page uses `/new` + `/:id` for its form (as attributes, tax rules, shipping rules, collections and bundle deals already do). A resource that has a detail page keeps `/:id` for the detail and uses `/:id/edit` (as products and purchase orders already do). The full table is in `specs/admin-shell/spec.md` — "Resource Authoring Routes".

The `/new` and `/:id` routes for a given resource **must** point at the same component. `ResourceFormPage` navigates from `/new` to `/:id` with `replace: true` after a create so that "Save and continue editing" turns the create form into the edit form; if the two routes rendered different components the page would remount mid-edit. `app-router.tsx:100-102` already carries this comment; the eleven new pairs inherit the rule.

**Why not one global convention:** making everything `/:id/edit` would either leave the five existing `/:id` form routes inconsistent or force migrating them too, and the second is a routing change to seven working pages for no merchant-visible gain.

### Decision 3 — Each resource exports its list path as a constant

`ResourceFormPage` needs `listPath`, and the list page needs the create/edit paths. Attributes and collections already export `ATTRIBUTES_PATH` / `COLLECTIONS_PATH` from their list module. Extend that: each of the eleven exports `<RESOURCE>_PATH` from its list page, and both ends import it. One string, one place, and a renamed route breaks at compile time rather than at runtime.

### Decision 4 — Context travels in the URL, not in router state

Categories opens its create modal pre-filled with a parent (`defaultParentId`) when adding a child inside the tree; sub-categories always creates under a parent. Carry that as a query parameter — `/catalog/categories/new?parentId=<id>` — read with `useSearchParams`.

**Why not `navigate(path, { state })`:** router state does not survive a reload or a copied link, which would break "Reloading a create page" and "Adding a child under a chosen parent" together — the page would come back with the parent silently cleared, and the merchant would create a top-level category without noticing. A query parameter survives both. It is also the only piece of pre-fill state in the whole change, so it needs no general mechanism.

### Decision 5 — Sub-categories reuse the category form pages, but keep their own routes

Sub-categories already reuses `CategoryCreateModal` / `CategoryEditModal`; a sub-category is a category with a parent. Keep the reuse — one `category-form-page.tsx` — but give sub-categories its own routes (`/catalog/sub-categories/new`, `/catalog/sub-categories/:categoryId`) so Cancel and "Save and return" land back on the list the merchant came from rather than on the category tree. The form page derives its `listPath` from which route matched.

### Decision 6 — Brands' bulk create becomes a page, not a mode of the create page

`BrandBulkCreateModal` takes a different input (a list) and reports differently (per-row results) from `BrandCreateModal`. Give it `/catalog/brands/bulk` as its own page rather than a tab or toggle on the create page. It is not an edit of anything, so it has no `/:id` counterpart and does not use `ResourceFormPage`'s create→edit navigation; it uses the layout directly with a single Save.

### Decision 7 — Guards move with the routes

`/settings/staff` and `/settings/audit-logs` sit under `RoleGuard roles={['OWNER','ADMIN']}`, `/settings/roles` under `RoleGuard roles={['OWNER']}`. Today the staff edit dialog and the new-role sheet are inside those guarded pages, so they inherit the check. As routes they must be declared inside the same `RoleGuard` elements — otherwise `/settings/staff/:userId` becomes reachable by URL to any authenticated user. The spec requires this ("Authoring Pages Inherit The List's Access Control"); it is called out here because it is the one place where extracting a form can silently widen access.

### Decision 8 — Order of work: shared layout first, then one resource end to end, then the rest

Build `resource-form-layout.tsx` and `resource-form-page-rhf.tsx`, then convert **suppliers** completely — it is the smallest react-hook-form overlay (191-line page, four fields) — and review it before the other seven. Brands converts first among the antd three for the same reason. This surfaces contract problems in the new shell while one page is affected rather than eleven.

## Risks / Trade-offs

- **Two form stacks survive this change, and the new `resource-form-page-rhf.tsx` entrenches the react-hook-form half.** → Its public API is deliberately the same as `ResourceFormPage`'s, so the follow-up antd migration is a per-page swap of one import and the field JSX, ending in a file deletion. Recorded here so it is a known debt with a known exit, not a discovery.
- **A form moved verbatim into a page can lose behaviour that the overlay's lifecycle provided for free.** Overlays reset on close; a page does not unmount between records the way a closed sheet did. Editing record A, going back, then editing record B must not show A's values. → `ResourceFormPage` already re-syncs on `record` identity (`resource-form-page.tsx:90-98`); `resource-form-page-rhf.tsx` must do the same with `form.reset(toValues(record))`, and the lazy route components must not be memoised across ids.
- **The category parent pre-fill is the one piece of cross-page state, and it is easy to drop.** → Decision 4 puts it in the URL, and the spec has scenarios for both the pre-filled and the plain create.
- **Widened access via new settings routes.** → Decision 7; verify by opening `/settings/staff/:userId` as a non-ADMIN.
- **Eleven list pages lose ~1,500 lines of JSX in one change; a mis-copied field is invisible until a merchant hits it.** → Decision 8 converts one resource at a time, each a self-contained commit, with the removed overlay and the new page in the same diff so the fields can be compared side by side.
- **More clicks for a quick edit.** Editing a supplier now costs a page load rather than a sheet slide. → Accepted: it is the point of the change, and it buys a linkable, reloadable, refresh-safe form. Route components stay `lazy()` as every other page is, so the cost is a small chunk fetch.

## Migration Plan

No data migration and no backend change. Deployment is a normal frontend release.

Old bookmarks are unaffected — every list URL keeps its meaning, and the new form URLs did not previously resolve to anything (`/catalog/brands/new` fell through to the `*` Not Found route, so nothing that worked before stops working).

Rollback is per-resource: because each conversion is one commit that removes an overlay and adds a page plus its routes, reverting that commit restores the overlay without touching the other ten.

## Open Questions

- Whether to follow this with the antd migration of the eight react-hook-form pages (Decision 1, alternative (a)). It changes nothing in this change's specs, approach, or tasks, and is better judged once the eight forms are pages and can be converted one at a time.
