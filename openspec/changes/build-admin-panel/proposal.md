## Why

The `admin` package is currently an empty Vite + React + TypeScript scaffold. The backend (`Ecom/server`) already exposes a full e-commerce API surface (see `server/postman/Ecom.postman_collection.json`, phases 1-7: catalog, cart/checkout, post-purchase, inventory & procurement, marketing, and support/admin governance). The business needs a working admin panel now to manage the store — catalog, orders, inventory, marketing, customers, support, and platform settings — using an industry-standard admin UI pattern (persistent sidebar navigation, data tables with filters/pagination, drawer/dialog forms, dashboard KPIs). No backend integration is available yet in this phase, so the panel ships with a typed mock-data layer that mirrors the real API's shapes, isolated behind a service/util layer so real HTTP calls can be swapped in later without touching page/component code.

## What Changes

- Scaffold the application shell: authenticated layout (collapsible sidebar + topbar + breadcrumbs), a separate auth layout (login/forgot-password), routing, theming, and a shared design system (tokens, primitives) with **compact spacing (reduced padding/margin vs. default component-library sizing) and no gradients anywhere** (solid fills/borders only).
- Establish the global navigation/menu structure derived from the Postman collection's endpoint groups, organized into sections: Dashboard, Catalog (Products/Categories/Brands), Inventory (Warehouses/Stock/Stock Movements/Suppliers/Purchase Orders), Sales (Orders/Payments/Shipments/Returns/Refunds/Shipping Methods), Marketing (Coupons/Campaigns/Banners), Customers (Customers/Reviews), Support (Support Tickets), Notifications, and Settings (Store Settings/Roles & Permissions/Staff Users/Audit Logs).
- Build list (data table: search, filter, sort, pagination) and detail/edit views for every resource in the menu above, backed by an in-memory mock dataset per resource.
- Build a Dashboard with summary KPI cards and charts (revenue, orders, low stock, recent activity) driven by mock aggregate data.
- Add a `src/lib/api/` util layer: one typed client module per resource (matching the Postman request shapes/query params) that currently reads/writes the in-memory mock store, so a future change can swap the implementation for real `fetch`/HTTP calls without changing calling code.
- Add shared UI primitives (button, input, select, table, dialog, drawer, dropdown, badge, tabs, toast, card, pagination) built on Radix UI primitives + Tailwind CSS, following the shadcn/ui pattern (source lives in the repo, not an opaque npm dependency).
- Add client-side auth/session scaffolding (login form, protected-route guard, role-aware nav item visibility for OWNER/ADMIN/STAFF) backed by mock session state — no real authentication yet.
- **BREAKING**: N/A (greenfield package; no prior behavior exists to break).

## Capabilities

### New Capabilities
- `admin-shell`: Application shell — routing, authenticated/auth layouts, navigation menu, design system tokens/primitives, role-aware nav visibility, mock session/auth guard.
- `catalog-management`: Products, Categories, and Brands list/detail/create/edit UI and mock data service.
- `inventory-management`: Warehouses, Stock, Stock Movements, Suppliers, and Purchase Orders UI and mock data service.
- `sales-management`: Orders, Payments, Shipments, Returns, Refunds, and Shipping Methods UI and mock data service.
- `marketing-management`: Coupons, Campaigns, and Banners UI and mock data service.
- `customer-management`: Customers (user accounts) and Product Reviews moderation UI and mock data service.
- `support-management`: Support Tickets (with threaded messages) and Notifications UI and mock data service.
- `platform-settings`: Store Settings, Roles & Permissions, Staff Users, and Audit Logs UI and mock data service.
- `dashboard`: Home dashboard with KPI summary cards and charts driven by mock aggregate data.

### Modified Capabilities
(none — greenfield package, no existing specs)

## Impact

- **Affected code**: entire `admin` package (`src/`) — this is the first feature work in the package.
- **New dependencies**: routing (`react-router`), styling (`tailwindcss`), UI primitives (`@radix-ui/*`), icons (`lucide-react`), forms (`react-hook-form`, `zod`), tables (`@tanstack/react-table`), charts (`recharts`), class utilities (`clsx`/`tailwind-merge`, `class-variance-authority`).
- **No backend/API integration in this change** — `src/lib/api/` returns/mutates mock data only; real integration is explicitly deferred to a future change.
- **No other systems affected** — `server/` is read-only reference material (Postman collection) for shaping menus, resource fields, and future request/response contracts.
