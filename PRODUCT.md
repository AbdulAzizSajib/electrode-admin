# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal operations staff at a single BD-based electronics/gadgets e-commerce business, with three roles: OWNER, ADMIN, and STAFF (role-aware navigation and access). They run day-to-day store operations — managing catalog, inventory, orders, marketing, customers, and support — not shoppers or external customers.

## Product Purpose

An internal admin panel to manage every side of an electronics/gadgets e-commerce store from one place: catalog (products/categories/brands/attributes/collections), inventory (warehouses/stock/stock movements/suppliers/purchase orders), sales (orders/payments/shipments/returns/refunds and courier dispatch), marketing (coupons/campaigns/banners/landing pages), content (blog/pages/testimonials), customers (accounts/reviews/support tickets), SEO, and platform settings (store settings/roles & permissions/staff users/audit logs). Success means staff can find, filter, and act on any resource in the store without leaving the panel.

## Positioning

The operational side of the same one-product system the storefront and server are the other halves of: it consumes the real backend HTTP API (`server/`, served at `http://localhost:5000/api/v1`) rather than mock data — resource fields, terminology, envelopes, and workflows mirror the backend contract exactly, and the backend stays the source of truth and the authorization boundary.

## Operating Context

- Electronics/gadgets retail in Bangladesh: catalog entries carry specs and variant/SKU detail; inventory and purchase-order workflows matter for stocking; returns/refunds handling matters for higher-value goods; BDT is the operative currency.
- Everything is already wired to the real backend via `src/lib/api/` (~45 resource modules) over the shared `request()`-based layer, with TanStack Query, TanStack Table (server-side search/paging/sorting), react-hook-form + zod, and Radix-owned primitives. Previously this layer was in-memory mock data; the mock-to-live swap is done.
- Live backend integration is not a future goal; it is the current state. The backend may be reachable or not while developing (the API base URL is intentionally hardcoded — see Capabilities).
- This is an existing, maturing codebase with long-form design rationale in code comments citing `openspec/changes/` paths; completed change folders are history, current source is truth.

## Capabilities and Constraints

- All list/detail/edit surfaces share a small set of reusable scaffolds: `ResourceListPage` + `ResourceFormPage` plus the shared `DataTable`, kept consistent so resources stay visually uniform.
- Auth is real: the backend requires both a better-auth session cookie and an app-issued `accessToken` JWT; role checks in the admin are UX-only, never the authorization boundary. There is no mock session state.
- Single light theme only; dark mode is deferred (token structure is designed to make it addable later without a rework).
- No localization is in use (i18next packages are present in dependencies but unused in `src/`).
- The API base URL is deliberately hardcoded (`http://localhost:5000/api/v1`) with no environment-variable override — an intentional architecture decision, not a gap.
- Responsive target is tablet width and up; phone-width layout was out of scope for the original build.
- Stack is established, not open: React 19 + TypeScript + Vite 8, react-router v8 (its own package, not `react-router-dom`), Tailwind CSS v4 (CSS-first tokens in `src/index.css`), owned-source shadcn/Radix primitives in `src/components/ui/` (antd and dayjs fully removed), TanStack Query + TanStack Table, react-hook-form + zod, Zustand, Recharts, Tiptap rich text, Vitest/jsdom.

## Brand Commitments

- The purple/violet favicon mark (`public/favicon.svg`, primary purple ~#863bff/#7e14ff with a light lavender ~#ede6ff and a `-color-background` of #F4F6F9) is confirmed, binding admin identity — not a placeholder.
- Default panel font is explicitly Google Roboto (user-confirmed; see `.impeccable/config.json` ignore rule).

## Evidence on Hand

- `server/postman/Ecom.postman_collection.json` is the API contract; `server/scripts/verify-*.ts` scripts exercise the services directly against the real database.
- No real customer/order/product content exists yet — all data is seeded fixtures; future work must not present it as real (pre-launch).

## Product Principles

1. Mirror the real backend's resource shapes, envelopes, and terminology exactly, so call sites and the UI never drift from the source of truth.
2. One shared list/detail/edit pattern across all ~45 resources — consistency and reuse over per-resource bespoke UI.
3. Electronics/gadgets in Bangladesh is the concrete vertical to design and write copy against, not generic "e-commerce" placeholders.
4. Comments are the spec of record: rationale lives beside the code, citing the openspec change that made the decision and naming what breaks if reversed.
5. Keep visual/system decisions structurally enforced (tokens, owned primitives, shared CRUD scaffolds) rather than left to per-instance convention, since dozens of modules must stay consistent.

## Accessibility & Inclusion

WCAG 2.1 AA is a binding requirement across all resource modules — contrast, focus visibility, and full keyboard operability — beyond whatever Radix's primitives provide by default.