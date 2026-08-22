## Context

See `proposal.md` - Why/What Changes for motivation and scope. Relevant constraints:

- `admin/` is currently the bare Vite + React 19 + TypeScript template (`react`, `react-dom`, no router, no styling framework, no UI kit).
- The backend's shape (resources, fields, phases) is only knowable from `server/postman/Ecom.postman_collection.json` — there is no OpenAPI schema and no running backend to introspect. That collection is the source of truth for resource field names used in mock types and forms.
- No backend integration is in scope for this change; every list/detail/form must work fully off in-memory mock data.
- Explicit design constraints from the user: compact spacing (less padding/margin than typical component-library defaults) and zero gradients anywhere in the UI.
- Nine capabilities (admin-shell, dashboard, catalog/inventory/sales/marketing/customer/support-management, platform-settings) ship together as one large surface — the design needs a structure that keeps 25+ resource modules consistent and lets a future change swap mock data for real HTTP calls with minimal churn.

## Goals / Non-Goals

**Goals:**
- One consistent pattern for "list a resource / create-edit a resource / view its detail" reused across all ~25 resources, so adding a resource is mostly filling in a config + form, not inventing new plumbing.
- A mock-data layer whose function signatures, types, and async/error/pagination shape are identical to what a real API-integration change would produce — so that future change only swaps an implementation, not call sites.
- A design system with compact spacing and no gradients enforced structurally (via Tailwind theme tokens and lint of raw class usage), not just by convention.

**Non-Goals:**
- Real backend/API integration, authentication, or authorization (mock session only) — deferred to a future change.
- Dark mode / theming beyond a single light theme (see Open Questions).
- Mobile (phone-width) layout — responsive support targets tablet width and up per `admin-shell` spec.
- Internationalization/localization.
- Automated end-to-end/visual regression testing infrastructure (unit/component tests for shared primitives and utils are in scope via tasks.md; broad E2E is not).

## Decisions

### 1. Feature-based folder structure, grouped by capability
`src/features/<capability>/{pages,components,hooks,types.ts}` (e.g. `src/features/catalog/products/...`), plus shared cross-cutting code in `src/components/ui` (design-system primitives), `src/components/layout` (shell: sidebar, topbar, breadcrumbs), `src/lib` (api clients, store, utils, validation schemas), and `src/routes` (route tree).
**Alternative considered**: type-based folders (`pages/`, `components/`, `hooks/` at the root). Rejected — with 25+ resources this scatters a single resource's list/form/hooks across three unrelated directories, making the codebase harder to navigate than grouping by capability, which is the pattern most large React admin codebases converge on.

### 2. Routing: `react-router` (v7, data router APIs)
Nested routes: a root layout route picks auth-layout vs. authenticated-shell-layout based on mock session state; each capability contributes a lazy-loaded route subtree. Route-level code splitting via `React.lazy`/`Suspense` keeps the initial bundle reasonable given the number of modules.
**Alternative considered**: file-based routing (e.g. TanStack Router). Rejected to keep the dependency surface smaller and because explicit route config makes the large nav tree (9 sections, 25+ leaf routes) easier to audit in one place.

### 3. Styling: Tailwind CSS (v4, CSS-first `@theme` config) + hand-rolled design tokens
Compact spacing is enforced by overriding Tailwind's default spacing/sizing scale for the primitives (buttons, inputs, table cells, card padding) rather than trusting call sites to remember smaller values. No gradient utility classes (`bg-gradient-*`) are used anywhere; solid `bg-*`/`border-*` tokens only. Semantic color tokens (background, foreground, muted, border, primary, destructive, warning, success) map to solid values.
**Alternative considered**: CSS Modules or vanilla-extract. Rejected — Tailwind plus a small `cva`-based primitive layer is the dominant pattern in current-generation admin UIs and keeps styling co-located with markup across dozens of near-identical list/form pages.

### 4. Component primitives: Radix UI + `class-variance-authority`, shadcn/ui-style (source in-repo)
Primitives (dialog, dropdown-menu, tabs, select, toast, etc.) wrap `@radix-ui/react-*` for accessible behavior, styled with Tailwind and variants defined via `cva`. Components live in `src/components/ui` as owned source (copy-in pattern), not consumed as an opaque pre-styled component package.
**Alternative considered**: a full pre-styled kit (MUI, Ant Design, Chakra). Rejected — those ship their own spacing/visual language (including gradient-friendly theming) that fights the "compact, no gradients" requirement; owning the primitives makes that requirement enforceable at the source instead of overridden per-instance.

### 5. Data tables: `@tanstack/react-table` (headless) behind a shared `<DataTable>` 
One shared component implements the admin-shell "Data Table Pattern" requirement (sort, filter, pagination, empty/loading state) on top of TanStack Table's headless primitives; each resource passes column defs and a data-fetching hook.
**Alternative considered**: hand-rolled table per resource. Rejected — would duplicate pagination/sort/filter logic 25+ times and produce inconsistent UX.

### 6. Mock data layer + data-fetching: `src/lib/api/<resource>.ts` functions wrapped by TanStack Query (`@tanstack/react-query`)
Each resource module exports typed request/response interfaces (field names taken from the Postman collection) and async functions (`list`, `getById`, `create`, `update`, `remove`, plus resource-specific actions like `receive` or `adjust`) that operate on an in-memory array seeded with fixture data and simulate network latency. Pages consume these exclusively through React Query hooks (`useQuery`/`useMutation`), giving real loading/error/cache/invalidation semantics now. A future API-integration change only needs to replace each function's body with a `fetch` call against `base_url` (already known from the Postman collection variable) — call sites, hooks, and loading/error UI do not change.
**Alternative considered**: plain `useState`/`useEffect` fetch-like hooks per resource. Rejected — 25+ hand-rolled data-fetching hooks would be inconsistent and more code than adopting the query library the future real integration will want anyway.
**Alternative considered**: skip async entirely and read mock arrays synchronously. Rejected — it would hide loading/error states that the spec requires pages to handle, and would make the future swap to real HTTP calls a bigger rewrite.

### 7. App-level state: Zustand for session + UI preferences
A small `useSessionStore` (mock role/user, persisted to `localStorage`) drives the auth guard and role-aware nav; a `useUiStore` holds sidebar-collapsed state. Server-shaped resource state stays in React Query's cache, not Zustand.
**Alternative considered**: React Context for session/UI state. Rejected — acceptable at this scale but Zustand avoids provider-nesting/re-render pitfalls once the nav and guard both subscribe to session state, and it's the more common pairing with React Query in current admin apps.

### 8. Forms: `react-hook-form` + `zod` schemas
Every create/edit form uses `react-hook-form` with a `zod` resolver; validation schemas live next to each feature's types so client-side validation rules (required fields, numeric ranges, date-order checks, uniqueness against the mock store) are declarative and testable.
**Alternative considered**: uncontrolled forms with manual validation. Rejected — inconsistent error UX across 15+ create/edit forms.

### 9. Charts: `recharts`
Used for the Dashboard's revenue/orders time-series. Chart fills use solid colors from the same semantic token set (no gradient defs), satisfying the no-gradients constraint.

## Risks / Trade-offs

- **[Large single change]** ~25 resources land together → harder to review as one unit. **Mitigation**: `tasks.md` phases work by capability (mirroring the Postman collection's own phases) so it can be implemented and reviewed capability-by-capability even though it's one OpenSpec change; the folder structure keeps each capability's diff self-contained.
- **[Mock data drift from real API contracts]** Hand-written mock types could diverge from what the real backend actually returns. **Mitigation**: field names/shapes are taken directly from the Postman collection's request bodies and example structure; `src/lib/api` docstrings note the source endpoint per function.
- **[React Query adopted before there's a real network call]** Adds a dependency that does "nothing" (no real caching value) until integration lands. **Mitigation**: accepted — the value is in matching the future call-site shape and getting correct loading/error state handling now instead of retrofitting it later.
- **[Tailwind v4's CSS-first config is newer]** Less prior art than v3. **Mitigation**: acceptable for a greenfield package; the `@theme` syntax needed here (spacing scale, color tokens) is stable in v4's current release.
- **[No dark mode]** Some stakeholders may expect it from an "industry standard" panel. **Mitigation**: semantic (not raw) color tokens are used throughout, so a dark theme can be added later by defining a second token set without touching component code — see Open Questions.

## Migration Plan

Greenfield package — no data migration or rollback concerns. Rollout is purely additive:
1. Install dependencies and configure Tailwind, path aliases, and lint/format rules.
2. Build design-system primitives and the app shell (routing, layouts, nav, mock session guard) first — every other capability depends on it.
3. Build `src/lib/api` mock modules and shared `<DataTable>`/form patterns next.
4. Implement capabilities in the phase order given in `tasks.md`, each independently runnable/verifiable in the dev server.
5. No feature flag or staged rollout needed — this is new code with no existing users.

## Open Questions

- Dark mode: not requested, deferred. Token structure keeps it addable later without spec or approach changes.
- Real API base URL / auth token strategy (cookies per the Postman collection vs. bearer tokens): deferred to the future API-integration change; `src/lib/api` is structured so that decision doesn't affect this change's code.
