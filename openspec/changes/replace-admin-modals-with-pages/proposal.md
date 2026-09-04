## Why

Record authoring in this panel is split down the middle. Seven resources — products, attributes, tax rules, shipping rules, collections, bundle deals, purchase orders — already create and edit on a full page at their own URL, through the shared `ResourceFormPage`. Eleven others still open an overlay: an antd `Modal` (brands, categories, sub-categories), a shadcn `Sheet` (suppliers, warehouses, banners, campaigns, vouchers, shipping methods, roles), or a `Dialog` (staff users). A merchant editing a voucher and a merchant editing a tax rule are doing the same job in two different interaction models, and the overlay half is the weaker one: the form cannot be linked to or bookmarked, a refresh or a back-press loses everything typed, a long form (banners is ~150 lines of fields) is cramped into a side panel, and a failed save has nowhere good to put the reason.

The overlay half is also where the form logic is duplicated. `ResourceFormPage` already decides how a save reports itself, where the merchant lands afterwards, and that a rejected save keeps every field — eleven overlays each re-answer those questions, and disagree.

## What Changes

- Move create and edit for eleven resources out of overlays and onto their own routed pages, each built on the existing `ResourceFormPage`:
  - **Catalog** — brands, categories, sub-categories
  - **Inventory** — suppliers, warehouses
  - **Marketing** — banners, campaigns (create), vouchers
  - **Sales** — shipping methods
  - **Settings** — roles, staff users (edit)
- Add `/new` and edit routes for each, following whichever convention that resource's neighbours already use: resources without a separate detail page take `/new` + `/:id` (as attributes and tax rules do); resources that already have a detail page take `/new` + `/:id/edit` (as products and purchase orders do). Campaigns only ever had a create overlay — a campaign is already edited in place on its detail page — so it gains a create route only; staff users only ever had an edit overlay, so they gain an edit route only.
- **New surface** (scope confirmed during apply): roles gain an edit page for name and description, backed by the `useUpdateRole` hook and `PATCH /roles/:id` that already existed but were never reachable from the UI. Without it, the roles create page would have a "Save and continue editing" button with nowhere to land. Which permissions a role grants is still toggled on the roles list, not here.
- Delete `brand-form-modal.tsx` and `category-form-modal.tsx`, and remove the `Sheet`/`Dialog` form blocks from the nine list pages that inline them, so a list page is a table and its row actions — nothing more.
- Brands keeps its bulk-create surface; it moves to its own page at `/catalog/brands/bulk` rather than staying a modal.
- Sub-categories reuses the category form pages rather than keeping its own copy, as it reuses the category modals today.
- **Not changing**: destructive confirmation (`ConfirmDialog`, `ReassignDeleteDialog`), the workflow action dialogs (adjust stock, receive items, record payment, create shipment, update order status, complete/set return status, issue refund, reply to review), and the read-only viewers (audit-log change detail, refund detail). These are confirmations and short in-context actions, not record authoring, and stay as overlays. `dialog.tsx` and `sheet.tsx` therefore remain in the design system.
- **Not changing**: any API module, hook signature, query key, or backend contract. Every form page calls the same mutations its overlay called.

## Capabilities

### New Capabilities
- `admin-shell`: `openspec/specs/` holds no capability specs yet (the `build-admin-panel` change that first described the shell was never archived), so this change adds the capability fresh, scoped to one concern — how the panel presents and routes record authoring. It states that create and edit are addressable pages rather than overlays, what such a page owes the merchant (deep-linkable URL, survives refresh, form preserved on a rejected save), which overlays are deliberately exempt, and the route for each resource. The capability id mirrors `build-admin-panel`'s naming so a future archive of that change's broader shell requirements lands in the same file.

### Modified Capabilities
(none)

## Impact

- **Deleted**: `src/features/catalog/brands/brand-form-modal.tsx`, `src/features/catalog/categories/category-form-modal.tsx`.
- **New form pages** (11 resources, 13 files — brands adds a bulk page, categories' page is shared with sub-categories): under `src/features/{catalog,inventory,marketing,sales,settings,customers}/…`.
- **Rewritten list pages**: `brands-page.tsx`, `categories-page.tsx`, `sub-categories-page.tsx`, `suppliers-page.tsx`, `warehouses-page.tsx`, `banners-page.tsx`, `campaigns-list-page.tsx`, `vouchers-page.tsx`, `shipping-methods-page.tsx`, `roles-permissions-page.tsx`, `staff-users-page.tsx` — overlay state and form markup removed, create/edit actions become navigations. Roughly 1,500 lines of form JSX move out of list pages.
- **Routing**: `src/routes/app-router.tsx` gains 17 routes and their lazy imports. `RoleGuard` coverage must extend to the new settings routes (`/settings/staff/:userId`, `/settings/roles/new`), which today inherit their guard from the list page they were embedded in.
- **`src/lib/api/**` — additive only** (scope confirmed during apply): an overlay was handed the row object it was opened from, so `suppliers.ts`, `warehouses.ts`, `shipping-methods.ts` and `staff-users.ts` never needed a single-record read. A deep-linked edit page does. Each gains a `getX`/`useX(id)` pair against the "Get by id" endpoint the backend already exposes, copying the pattern in `banners.ts` and `coupons.ts`; `queryKeys.shippingMethods` and `queryKeys.staffUsers` each gain a `detail` key. No existing function, hook signature or query key changes.
- **Unchanged**: every other module under `src/lib/api/`, `src/routes/nav-config.ts` (form pages are not nav destinations), `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/confirm-dialog.tsx`, `components/crud/reassign-delete-dialog.tsx`.
- **Risk**: `categories-page.tsx` opens its create modal pre-filled with a parent when adding a child inside the tree; that intent has to survive the navigation. Same for sub-categories, which always creates under a parent.
