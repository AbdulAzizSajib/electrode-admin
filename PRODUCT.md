# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal operations staff at a single electronics/gadgets e-commerce business, with three roles: OWNER, ADMIN, and STAFF (role-aware navigation and access). They run day-to-day store operations — managing catalog, inventory, orders, marketing, customers, and support — not shoppers or external customers.

## Product Purpose

An internal admin panel to manage every side of an electronics/gadgets e-commerce store from one place: catalog (products/categories/brands), inventory (warehouses/stock/stock movements/suppliers/purchase orders), sales (orders/payments/shipments/returns/refunds/shipping methods), marketing (coupons/campaigns/banners), customers (accounts/reviews), support (tickets/notifications), and platform settings (store settings/roles & permissions/staff users/audit logs). Success means staff can find, filter, and act on any resource in the store without leaving the panel.

## Positioning

Built to match a specific, already-defined backend API (`Ecom/server`, documented via its Postman collection) rather than a generic admin-kit template — resource fields, terminology, and workflows mirror that backend's real shapes so a future integration change swaps mock data for live HTTP calls without touching page or component code.

## Operating Context

- Electronics/gadgets retail: catalog entries carry specs and variant/SKU-level detail; inventory and purchase-order workflows matter for stocking; returns/refunds handling matters for higher-value goods.
- Currently ships against an in-memory mock-data layer (`src/lib/api/`) with real network-shaped async/loading/error/pagination semantics (TanStack Query), seeded from the Postman collection's field shapes — no live backend integration yet; that is explicitly deferred to a future change.
- Nine capabilities / ~25 resource modules share one list+detail/edit pattern (data table with search/filter/sort/pagination, drawer/dialog forms) so the UI stays consistent as resources are added.
- Built and largely implemented already (`openspec/changes/build-admin-panel`, 65/70 tasks complete as of 2026-08-22) — this is an existing, maturing codebase, not a greenfield start.

## Capabilities and Constraints

- Responsive target is tablet width and up; phone-width layout is explicitly out of scope for this change.
- Single light theme only; dark mode is deferred (token structure is designed to make it addable later without a rework).
- No internationalization/localization currently.
- No real authentication/authorization yet — session/role state is mocked (Zustand, persisted to localStorage) to drive the auth guard and role-aware nav; real auth is deferred.
- Stack is established, not open: React 19 + TypeScript + Vite, react-router (data router), Tailwind CSS v4 (CSS-first `@theme`), Radix UI primitives styled via `class-variance-authority` in a shadcn/ui-style owned-source pattern (`src/components/ui`), TanStack Query + TanStack Table, react-hook-form + zod, Zustand, Recharts.

## Brand Commitments

- Product name "Ecom Admin" and the purple/violet favicon mark (`public/favicon.svg`, primary purple ~#863bff/#7e14ff with a light lavender ~#ede6ff and blue ~#47bfff accent) are confirmed, binding brand identity — not placeholders.

## Evidence on Hand

- `server/postman/Ecom.postman_collection.json` (in the sibling `Ecom/server` package) is the source of truth for resource field names, request/response shapes, and endpoint grouping used throughout the mock data layer and nav structure.
- No real customer/order/product content, testimonials, or benchmarks exist yet — all current data is fixture/mock data seeded to mirror the real API's shapes; future work must not present it as real.

## Product Principles

1. Match the real backend's resource shapes and terminology now, so the eventual mock-to-live swap changes only `src/lib/api/` implementations, never call sites or UI.
2. One shared list/detail/edit pattern across all ~25 resources — consistency and reuse over per-resource bespoke UI.
3. Electronics/gadgets is the concrete vertical to design and write copy against, not generic "e-commerce" placeholders.
4. Design for the true internal-ops usage scene (tablet+ desks, not phones) rather than chasing full responsive coverage prematurely.
5. Keep visual/system decisions structurally enforced (tokens, owned primitives) rather than left to per-instance convention, since 25+ modules must stay consistent.

## Accessibility & Inclusion

WCAG 2.1 AA is a binding requirement across all resource modules — contrast, focus visibility, and full keyboard operability — beyond whatever Radix's primitives provide by default.
