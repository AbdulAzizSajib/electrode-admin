# Admin Agent Guide

React 19 + Vite SPA using React Router data routing, TanStack Query, React Hook Form, Zod, and owned-source shadcn/Radix components. Read the root [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), and [PRODUCT.md](PRODUCT.md) before making product or workflow decisions.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm exec vitest run src/path/to/file.test.tsx
```

The API runs at `http://localhost:5000`; the admin dev server runs at `http://localhost:5173`. This app is its own Git repository.

## Required conventions

- Use the live API modules under `src/lib/api/`. Route requests through the shared `request()` or `requestData()` helper; do not add mock data or direct ad hoc `fetch` calls.
- The API base URL is intentionally hardcoded in `src/lib/api/client.ts` as `http://localhost:5000/api/v1`; do not introduce an environment-variable override without an explicit architecture change.
- Do not import or add `antd`. Forms use React Hook Form + Zod + the local shadcn `Form` primitives. Reuse the CRUD scaffolds in `src/components/crud/` for standard resource pages.
- On edit pages, mount the form after the record loads so Radix Select values are not cleared by an early reset. A refused save must leave entered values intact and show the reason above the fields.
- Keep route guards and `RequireRole` checks as UX behavior only. The backend remains the authorization boundary; never rely on admin-side role checks for security.
- Put feature code under `src/features/<domain>/` and shared API/data behavior under `src/lib/`. Follow neighboring components before introducing new abstractions.
- Use the shared UI primitives and existing validation helpers, including the numeric-field behavior where a cleared input is `undefined`, not `0`.
- Update focused Vitest coverage for behavior changes. Tests use `jsdom` and the shared `src/test-setup.ts`.

Before changing a feature, inspect its route entry, API module, nearest CRUD scaffold, and neighboring test. Completed `openspec/changes/` entries are historical context; current source and the linked product/instruction files are authoritative.
