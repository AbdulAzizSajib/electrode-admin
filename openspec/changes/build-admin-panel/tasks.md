## 1. Project Setup & Tooling

- [x] 1.1 Install dependencies: `react-router`, `tailwindcss` (v4) + `@tailwindcss/vite`, `@radix-ui/react-*` (dialog, dropdown-menu, tabs, select, toast/toast primitives, avatar, checkbox, label, popover, separator, slot, switch, tooltip), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-table`, `@tanstack/react-query`, `recharts`, `zustand`.
- [x] 1.2 Configure Tailwind v4 (`@theme` tokens: compact spacing scale, semantic solid color tokens, no gradient utilities registered) and wire it into `vite.config.ts`.
- [x] 1.3 Configure TypeScript path aliases (e.g. `@/*` → `src/*`) in `tsconfig.app.json` and `vite.config.ts`.
- [x] 1.4 Scaffold the feature-based folder structure: `src/components/ui`, `src/components/layout`, `src/lib/{api,store,utils,validation}`, `src/routes`, `src/features/<capability>/...` per capability.
- [x] 1.5 Add `src/lib/utils/format.ts` (currency, date, number formatting helpers reused across list/detail views).

## 2. Design System Primitives

- [x] 2.1 Implement base primitives with compact spacing and no gradients: Button, Input, Select, Textarea, Checkbox, Switch, Label, FormField wrapper.
- [x] 2.2 Implement Card, Badge, Tabs, Separator, Avatar, Tooltip.
- [x] 2.3 Implement Dialog, Drawer/Sheet, DropdownMenu, Popover.
- [x] 2.4 Implement Toast/notification primitive and a `useToast` hook.
- [x] 2.5 Implement Table primitives (Table, TableHeader, TableRow, TableCell) and Pagination control.
- [x] 2.6 Implement shared `<DataTable>` component on `@tanstack/react-table` (sorting, global/column filter, pagination, empty/loading/error states) per `admin-shell` spec's Data Table Pattern requirement.
- [x] 2.7 Implement a `ConfirmDialog` primitive for destructive-action confirmation (delete, cancel, etc.), reused by every capability's delete/cancel flows.

## 3. App Shell & Mock Session

- [x] 3.1 Implement `useSessionStore` (Zustand, persisted): mock login/logout, current user, role (OWNER/ADMIN/STAFF).
- [x] 3.2 Implement `useUiStore` (Zustand): sidebar collapsed/expanded state.
- [x] 3.3 Build the Auth layout and Login page (form validation via react-hook-form + zod; any well-formed credentials establish a mock session).
- [x] 3.4 Build the Forgot Password page (mock flow only, no real email/OTP).
- [x] 3.5 Build the authenticated Shell layout: collapsible Sidebar, Topbar (search input, notifications entry, account menu with Logout), Breadcrumbs.
- [x] 3.6 Define the navigation menu config (sections → items → routes → required role) covering Dashboard, Catalog, Inventory, Sales, Marketing, Customers, Support, Notifications, Settings.
- [x] 3.7 Implement role-aware nav filtering and an `AuthGuard`/`RoleGuard` route wrapper that redirects unauthenticated visitors to Login and hides/blocks role-restricted routes.
- [x] 3.8 Wire up `react-router` route tree: root layout switch (auth vs. shell), lazy-loaded route subtree per capability, breadcrumb-friendly route naming.
- [x] 3.9 Implement responsive behavior: sidebar collapses to off-canvas overlay below the tablet breakpoint.

## 4. Mock Data & API Util Layer

- [x] 4.1 Define shared mock-layer conventions in `src/lib/api/client.ts`: simulated latency helper, paginated-response envelope type, error simulation helper — the shape a future real `fetch` client will also expose.
- [x] 4.2 Define shared query-key and React Query setup (`QueryClientProvider` in app root, default options).
- [x] 4.3 Create per-resource mock modules (types + in-memory seed data + list/get/create/update/remove + resource-specific actions) under `src/lib/api/`, field names sourced from the Postman collection, for: categories, brands, products.
- [x] 4.4 ...same for: warehouses, stock, stock-movements, suppliers, purchase-orders.
- [x] 4.5 ...same for: orders, payments, shipments, returns, refunds, shipping-methods.
- [x] 4.6 ...same for: coupons, campaigns, banners.
- [x] 4.7 ...same for: customers (users w/ CUSTOMER role), staff-users, reviews.
- [x] 4.8 ...same for: support-tickets (+ messages), notifications.
- [x] 4.9 ...same for: store-settings, roles, permissions, audit-logs.
- [x] 4.10 Implement a small mock "audit trail" hook used by mutating actions across capabilities to append entries consumed by the Audit Log viewer (per `platform-settings` spec).

## 5. Dashboard

- [x] 5.1 Build mock aggregate/time-series fixtures (revenue, orders, low-stock, customers) with a selectable time range.
- [x] 5.2 Build KPI summary cards (revenue, orders, customers, low-stock) with trend indicators.
- [x] 5.3 Build revenue-over-time and orders-over-time charts (recharts) with time-range selector.
- [x] 5.4 Build Recent Orders widget and Low Stock widget, each linking to the relevant detail page, with empty states.

## 6. Catalog Management

- [x] 6.1 Products: list page (search, filters by category/brand/status, pagination) using `<DataTable>`.
- [x] 6.2 Products: create/edit form (validation, image fields, category multi-select, brand select, publish status) and detail page.
- [x] 6.3 Products: delete with confirmation; category link/unlink on the edit form.
- [x] 6.4 Categories: list, create/edit (parent selector for nesting), delete with children-guard.
- [x] 6.5 Brands: list, create/edit (slug uniqueness validation), delete.

## 7. Inventory Management

- [x] 7.1 Warehouses: list, create/edit, delete with in-use guard.
- [x] 7.2 Stock: list (filter by warehouse/product), adjust-quantity action (reason required) that also writes a stock movement.
- [x] 7.3 Stock Movements: read-only filterable history list.
- [x] 7.4 Suppliers: list, create/edit, delete with in-use guard.
- [x] 7.5 Purchase Orders: list, create (line items, computed total), detail, edit.
- [x] 7.6 Purchase Orders: Receive action (full/partial) updating stock, stock movements, and PO status; delete only allowed pre-receipt.

## 8. Sales Management

- [x] 8.1 Orders: list (search, status/date/customer filters), detail view (line items, pricing breakdown, addresses, status timeline).
- [x] 8.2 Orders: status update flow and cancellation (blocked post-shipment) with confirmation.
- [x] 8.3 Payments: per-order payment records list + record-manual-payment action recalculating payment status.
- [x] 8.4 Shipments: per-order shipment record view + create/update action advancing order fulfillment status.
- [x] 8.5 Returns: list, detail, status update; completing a return restocks inventory (warehouse-scoped) and records a stock movement.
- [x] 8.6 Refunds: list, detail (view dialog + create-refund action) linked to an order.
- [x] 8.7 Shipping Methods: list, create/edit, delete with in-use guard.

## 9. Marketing Management

- [x] 9.1 Coupons: list, create/edit (code uniqueness, discount type/value, validity window validation), delete.
- [x] 9.2 Campaigns: list, create/edit, detail (with mock performance metrics), delete.
- [x] 9.3 Banners: list (with reorder and inline active-toggle), create/edit, delete.

## 10. Customer Management

- [x] 10.1 Customers: list (search), detail (profile, addresses, order history linking to Sales).
- [x] 10.2 Staff/Admin Users: list (search), role and active-status edit.
- [x] 10.3 Reviews: list (filter by status/rating), status change (approve/reject) and content edit/remove.

## 11. Support Management

- [x] 11.1 Support Tickets: list (filter by status/priority), detail with message thread and reply action.
- [x] 11.2 Support Tickets: status/priority update.
- [x] 11.3 Notifications: topbar unread-count badge, notifications list, mark-one/mark-all-as-read.

## 12. Platform Settings

- [x] 12.1 Store Settings: form (name, contact email, currency, tax rate, free-shipping threshold), OWNER/ADMIN-only guard.
- [x] 12.2 Roles & Permissions: role list/create/edit, permission catalog view, assign/remove permission on a role, in-use delete guard; OWNER-only guard.
- [x] 12.3 Audit Logs: read-only filterable (actor/action/date) log viewer consuming the shared audit-trail hook from task 4.10.

## 13. Cross-Cutting Polish & Verification

- [ ] 13.1 Sweep every page for empty/loading/error state coverage per the `admin-shell` Data Table Pattern requirement.
- [ ] 13.2 Sweep every surface for gradient usage and spacing consistency against the design-system tokens (no gradients; compact spacing applied, not just available).
- [ ] 13.3 Verify responsive behavior at tablet width (~768px) and desktop width (1280px+) across shell, tables, and forms.
- [ ] 13.4 Verify role-aware nav/guarding manually for OWNER, ADMIN, and STAFF mock sessions.
- [ ] 13.5 Run `npm run lint` and `npm run build` (tsc + vite build) and fix any errors/warnings introduced.
