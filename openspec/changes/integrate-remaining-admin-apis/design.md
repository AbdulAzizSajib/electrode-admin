## Context

See proposal.md — Why. The relevant current state for this design:

- 17 of 30 `src/lib/api/*` modules already call the real backend; each one carries its **own private copy** of an identical `request<T>()` helper (`credentials: 'include'`, unwraps `{ success, message, data, meta? }`, throws `ApiError` on `!res.ok || !json.success`). `brands.ts` even documents the duplication in a comment pointing at `categories.ts`.
- `src/lib/api/client.ts` still exports the mock scaffolding (`delay`, `paginate`, `generateId`, `matchesSearch`) alongside the shared real types (`BASE_URL`, `ApiError`, `ListParams`, `PaginationMeta`, `PaginatedResponse`).
- The 13 remaining mock modules are **coupled to each other through underscore-prefixed mock accessors** that reach across module boundaries at import time:
  - `users.ts` exports `_getAllUsers` / `_getUserById` / `_setUsers`, read by `customers.ts`, `roles.ts`, `staff-users.ts`, and `support-tickets.ts`.
  - `permissions.ts` exports `_getAllPermissions`, read by `roles.ts` (at module-seed time).
  - `roles.ts` exports `_isRoleInUse`, used for a client-side 409 pre-check before delete.
  - `audit-logs.ts` exports `recordAuditEntry`, called by `banners.ts`, `campaigns.ts`, `coupons.ts`, `roles.ts`, and `staff-users.ts` after every mutation.
  This is why the remaining modules cannot be migrated one at a time in arbitrary order: cutting `users.ts` breaks four other modules simultaneously.
- Backend search convention is `searchTerm` (not `search`); the existing real modules already translate `ListParams.search` → `searchTerm` at the call boundary.
- Two backend endpoints the admin panel needs **do not exist**: an admin customer list, and pagination/search/role-assignment on users. Confirmed by reading `src/app/routes/index.ts` (only `/customers/me/addresses` is mounted) and `user.service.ts` (`getAllUsers` is a bare `findMany` with no arguments; `updateUserZodSchema` has no `roleId`).

## Goals / Non-Goals

**Goals:**

- Zero mock data anywhere in `src/lib/api/` when this change is done — no `delay()`, no seeded arrays, no underscore cross-module accessors.
- One shared `request<T>()` implementation, not 30.
- Backend response shape is the source of truth; UI adapts to it. No translation layer that re-creates the mock shapes.
- Each phase leaves the app in a working, shippable state.

**Non-Goals:**

- Redesigning any page's visual layout or information architecture. Pages change only as far as the reshaped data requires.
- Editing the store settings JSON configuration blocks (`mainNav`, `footerColumns`, `socialLinks`, `announcementBar`, `newsletter`). They are read and sent back unchanged; a structured editor for them is its own change.
- Ticket assignment UI. The backend has `assignedToId`, and the specs require *displaying* the assignee, but a staff-picker assignment flow is deferred.
- Backfilling audit-log entries for actions the backend does not yet audit. This change stops the admin panel from writing fake entries; it does not add server-side audit coverage.
- Notification creation or push/email delivery. The admin panel only reads and marks read.
- Variant-level or storefront-facing behavior of any kind.

## Decisions

### Decision 1: Extract `request<T>()` to `src/lib/api/request.ts` first, as Phase 0

**Choice**: One module exporting `request<T>()` and `ApiEnvelope<T>`; all 17 existing real modules re-point at it; the 12 new ones import it from the start.

**Why**: 11 more copies of the same 12-line function is the alternative, and the duplication is already flagged in-code as a known wart. Doing it *first* means the migration phases are pure "swap the bodies" work rather than "swap the bodies and also decide where the helper lives".

**Alternatives considered**: Leave the duplication and copy it 11 more times — rejected, it makes any future change to error handling a 30-file edit. Introduce a full API-client class or a generated client — rejected as far more churn than this change needs; the existing helper is fine, it just needs one home.

**Risk this creates**: it touches 17 already-working modules. Mitigated by making it a byte-for-byte extraction (no behavior change) done as its own commit, so a regression is trivially bisectable.

### Decision 2: Delete the mock helpers from `client.ts` rather than deprecating them

`delay()`, `paginate()`, `generateId()`, and `matchesSearch()` exist only to serve mock modules. Once the last mock is gone they have zero call sites. Leaving them invites a future module to be written mock-first again — which is exactly the state this change is ending. `BASE_URL`, `ApiError`, `ListParams`, `PaginationMeta`, `PaginatedResponse` stay; they are real-API types.

The file's header comment ("Shared conventions for the mock API layer… so that a future API-integration change can replace each function's body") is rewritten — this *is* that change, and the comment would otherwise describe a state that no longer exists.

### Decision 3: Migration order is dictated by the mock coupling graph, not by page importance

The underscore accessors force the order. `users.ts` is the hub: `customers.ts`, `roles.ts`, `staff-users.ts`, and `support-tickets.ts` all read `_getAllUsers()`. So:

- **Phase 1** takes the three modules with *no* cross-module coupling (`store-settings`, `audit-logs`, `notifications`) — except that `audit-logs.ts` must keep exporting a no-op-free `recordAuditEntry` until Phase 2/3 delete its callers. Resolved by deleting `recordAuditEntry` **and** its five call sites in the same commit: the call sites are all in modules that are themselves still mock at that point, and removing a mock-only side effect from a mock module is safe.
- **Phase 2** (marketing) removes 3 of the 5 `recordAuditEntry` callers and has no other coupling.
- **Phase 3** (RBAC) is the hub cut: `users.ts`, `roles.ts`, `permissions.ts`, and `staff-users.ts` must migrate together because `_getAllUsers`, `_getAllPermissions`, and `_isRoleInUse` die together.
- **Phase 4** (support tickets) is last among the admin-only modules because it reads `_getAllUsers()` and so depends on Phase 3.
- **Phase 5** (customers) also reads `_getAllUsers()` *and* needs a backend endpoint that does not exist yet, so it is last.

**Alternative considered**: migrate strictly by nav group (Marketing → Support → Settings → Customers). Rejected — it cuts the `users.ts` hub in the middle of the Support phase, leaving `roles.ts` and `staff-users.ts` importing a deleted accessor.

### Decision 4: No compatibility shims for the deleted accessors

Earlier changes (`integrate-products-api`) gave `_getAllProducts()` a shim because a *still-mock* module needed it. Here, every consumer of every accessor is itself migrated inside this change, so a shim would be dead code from the moment it is written. Phase 3 deletes `_getAllUsers`/`_setUsers`/`_getUserById`/`_getAllPermissions`/`_isRoleInUse` outright.

`_isRoleInUse`'s client-side 409 pre-check is dropped rather than reimplemented: the backend returns a proper conflict with a message on `DELETE /roles/:id`, and the established pattern in `categories.ts`/`suppliers.ts` is to surface the backend's error rather than duplicate the check client-side.

### Decision 5: Drop mock-only capabilities instead of emulating them

Three mock features have no backend equivalent, and each is removed rather than faked:

| Mock feature | Backend reality | Resolution |
|---|---|---|
| `reorderBanner(id, 'up' \| 'down')` | `sortOrder` is a plain int on `PATCH /banners/:id`; no swap endpoint | Edit `sortOrder` directly as a number field |
| `Campaign.metrics` (views, redemptions) | `Campaign` model has no counters | Remove the metrics panel from campaign detail |
| `Campaign.couponIds` | No `Campaign`↔`Coupon` relation exists | Remove coupon association from the campaign form |
| `Permission.category` | `Permission` has `name` + `description` only | Ungrouped permission list |
| `AuditLogEntry.resourceLabel` | No such column | Show `entity` + `entityId` |

Emulating a two-item swap client-side, or computing campaign metrics from orders, would each be inventing a feature under cover of an integration change. If they are wanted, they are their own proposals.

### Decision 6: Unread notification count is derived from the list, not a dedicated request

The backend exposes `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all` — there is **no** count endpoint. The header badge therefore derives its count from the notification list query the app already holds, filtered on `isRead`.

**Consequence, accepted**: the badge counts unread notifications *within the fetched page*, not across all history. For a badge whose purpose is "you have something new", a page-scoped count with the list sorted newest-first is adequate. If an exact global count is needed later, it wants a backend `GET /notifications/unread-count`, which is a backend change, not a client workaround.

**Alternative considered**: fetch with `limit=1` and read `meta.total` with an `isRead=false` filter. Rejected for now — it assumes the endpoint supports an `isRead` filter, which is not established; the derived count needs no such assumption.

### Decision 7: Multipart for banners, matching the established upload pattern

`POST /banners` and `PATCH /banners/:id` use `multerUpload.fields([{image}, {mobileImage}])` with the JSON payload under a `data` field — the same convention `brands.ts` (single `logo`) and `categories.ts` (`image` + `banner`) already implement. Banner create/update therefore sends `FormData` and **must not** set a `Content-Type` header (the browser sets the multipart boundary).

This means `request<T>()` cannot hardcode `'Content-Type': 'application/json'` as the current copies do. The extracted helper sets the JSON content type **only when the body is not `FormData`**. This is a real behavior change to the shared helper and is the one part of Decision 1 that is not a pure extraction — called out here so it is verified against the existing brand/category upload flows when Phase 0 lands.

### Decision 8: Backend gaps are filled in `electrode-server`, tracked as explicit cross-repo tasks

The admin repo's OpenSpec `allowedEditRoots` covers `electrode-admin` only. The user has explicitly chosen to fill the backend gaps in this same change, so the server edits are performed in `D:\Next.js\electrode\electrode-server` and marked in tasks.md with an explicit repo prefix so it is never ambiguous which tree a task touches.

**`GET /users`** — extend to accept `page`, `limit`, `searchTerm` (name/email), `roleId`, `status`, returning the project's standard paginated envelope. Today it is `prisma.user.findMany({ where: { isDeleted: false }, orderBy: { createdAt: 'desc' } })` — every user, unpaginated. Follow the same query-builder convention the other admin list endpoints use.

**`updateUser`** — add `roleId` and `status` to `IUpdateUserPayload` and `updateUserZodSchema`. `roleId` must be validated to reference an existing `Role`, and changing it must be **OWNER-only**, consistent with `/roles` being OWNER-only: allowing an ADMIN to grant themselves an OWNER role through the user endpoint would route around that restriction entirely. `updateOwnProfileZodSchema` is deliberately left untouched — it already omits `isActive` for the same reason, and must not gain `roleId` or `status`.

**`GET /customers` and `GET /customers/:id`** — new admin-only routes in `src/app/module/customer/`, mounted at `/customers`. The existing `CustomerAddressRoutes` stays mounted at `/customers/me/addresses`; the new router must be mounted **after** it in `src/app/routes/index.ts`, or `/customers/:id` will capture the literal `me` segment — the same declaration-order hazard already documented in `product.route.ts` and `campaign.route.ts`.

Order count and total spent are computed **server-side** (a Prisma aggregate over the customer's orders), not by having the admin fetch an order list and sum it. The spec requires backend-reported totals precisely because a client-side sum over a paginated order list is silently wrong.

### Decision 9: Role-aware navigation, because the backend's authorization is not uniform

The endpoints this change consumes sit at three different privilege levels: `/roles` and `/permissions` are **OWNER-only**; `/audit-logs`, `/settings`, `/banners/admin`, `/coupons`, `/campaigns`, `/users` are **OWNER/ADMIN**; `/support-tickets` reads are open to all roles with OWNER/ADMIN/STAFF needed to update.

The nav config and route guards must encode this, so a STAFF session is not shown a Roles & Permissions link whose every request 403s. Pages already reachable today keep their current guards; only the newly-integrated ones need their required role set. This is behavior the specs require (`access-control-management` — Owner-Only Access), not a cosmetic nicety.

### Decision 11: The banner form is driven by the backend's per-type contract (found during Phase 2)

`banner.validation.ts` enforces a contract the proposal did not account for: a `DYNAMIC` banner **requires** `title`, and an `IMAGE` banner **requires** `image` and is **rejected** if it carries any of the eight dynamic-only fields (`title`, `subtitle`, `description`, `price`, `discountPrice`, `buttonText`, `bgColor`, `textColor`). Sending them on an IMAGE banner is a 400, not a field the backend ignores.

So the form shows the dynamic fields only when the type is DYNAMIC, and `toBannerPayload` omits those keys entirely for an IMAGE banner rather than sending empty strings. The IMAGE artwork requirement is checked in `onSubmit` rather than in the Zod schema, because a newly picked file satisfies it just as a stored URL does and the file lives in component state, outside the schema's view.

### Decision 12: Campaign products carry their own discount (found during Phase 2)

The proposal described campaign products as an id list. They are not: each `CampaignProduct` carries `discountType` (`PERCENTAGE`/`FIXED`) and `discountValue`, so the detail page collects a discount per product rather than offering a bare multi-select.

`PATCH /campaigns/:id` replaces the whole association list, so add and remove both send the complete resulting array — there is no per-association endpoint.

### Decision 10: Nullability is surfaced, not defaulted away

The backend makes far more fields nullable than the mocks did (`Banner.image`, `Coupon.minimumOrderAmount`, `Campaign.startsAt`, `AuditLog.user`, `SupportMessage.sender`, `Customer.email`/`phone`, `User.lastLoginAt`). The TypeScript types mirror that nullability exactly, and the UI renders an explicit empty/unknown indicator.

Coercing `null` to `''` or `0` at the API boundary would be the tempting shortcut and is rejected: it makes "no minimum order amount" indistinguishable from "minimum order amount of zero", and "never signed in" indistinguishable from the epoch. Several specs pin this as explicit scenarios.

## Risks / Trade-offs

- **Phase 0 touches 17 working modules** → Keep it a pure extraction with the single documented exception (Decision 7's `FormData` content-type handling); land it as its own commit; smoke-test one already-real upload flow (brand logo) and one plain-JSON flow before starting Phase 1.
- **Phase 3 is an all-or-nothing cut of four modules** → It cannot be split, because the accessors die together. Mitigation: it depends on backend changes, so do the `electrode-server` work *first* within the phase and verify both endpoints by hand (or via the repo's Postman collection) before touching the admin modules.
- **The backend `updateUser` change can escalate privilege if `roleId` is not OWNER-gated** → Explicitly required in Decision 8. This is the highest-severity item in the change; verify with a negative test that an ADMIN cannot set any user's `roleId`.
- **Mounting `/customers` incorrectly shadows `/customers/me/addresses`** → Mount order is specified in Decision 8; verify the existing address routes still resolve after mounting.
- **Enum values change from lowercase mock strings to uppercase backend enums across many pages** (`'open'` → `OPEN`, `'percentage'` → `PERCENTAGE`, …) → Any missed comparison fails silently as a filter that matches nothing rather than as a type error, since both sides are strings. Mitigation: define each enum as a `const` array in its API module and derive both the TypeScript union and the UI's option lists from it, so a stale literal cannot survive on its own.
- **The header notification badge becomes page-scoped** (Decision 6) → Accepted and documented; the fix is a backend count endpoint, not client-side paging through all notifications.
- **Deleting `recordAuditEntry` removes entries the audit page used to show** → Those entries were fabricated client-side and never persisted; the page will show fewer, but real, entries. Worth stating plainly to whoever reviews the audit page after Phase 1, so the drop is not mistaken for a regression.
- **Store settings save could clobber the JSON config blocks** (Decision 2 in specs: Preservation of Unedited Settings) → The update must send back the untouched blocks as received, or use a partial update that omits them entirely. Verify against a store whose nav/footer config is populated.

## Migration Plan

Each phase is a shippable increment; the app builds and runs after every one.

1. **Phase 0** — extract `request.ts`, re-point 17 modules, trim `client.ts` mock helpers (the helpers can only be deleted once the last mock module is gone — so in practice Phase 0 *adds* `request.ts` and re-points, and the `client.ts` deletion lands at the end of Phase 5). Verify: brand logo upload (multipart) and any plain-JSON list still work.
2. **Phase 1** — `store-settings`, `audit-logs`, `notifications`; delete `recordAuditEntry` and its five call sites.
3. **Phase 2** — `banners`, `coupons`, `campaigns`.
4. **Phase 3** — `electrode-server` user changes first, verified; then `users`, `roles`, `permissions`, `staff-users` together; delete all underscore accessors.
5. **Phase 4** — `support-tickets`.
6. **Phase 5** — `electrode-server` customer endpoints first, verified; then `customers`; finally delete the mock helpers from `client.ts` and confirm no `delay(`/`generateId(`/`paginate(` references remain.

**Rollback**: each phase is an independent commit touching a disjoint set of API modules and their pages; reverting one phase does not disturb the others. The two `electrode-server` commits are additive (new optional query params, new routes) and backward-compatible with the current storefront and admin clients, so they can be left in place even if an admin-side phase is reverted.

**Verification gate for each phase**: the migrated pages load real data, list filters round-trip to the backend, mutations persist across a page reload (the definitive mock-vs-real test — mock state reset on reload), and `grep` finds no remaining `delay(` in the phase's modules.

## Open Questions

- Which specific `Permission` records the backend seeds, and whether their `name` values are structured (e.g. `product.create`) or free text. This affects only how the permission list is *labelled*, not the grant/revoke behavior the spec pins down, so it can be answered when Phase 3 starts by reading the seeded rows.
- ~~Whether `GET /notifications` supports an `isRead` query filter.~~ **Resolved during Phase 1**: it does — `notification.service.ts` declares `filterableFields: ["isRead", "type", "priority"]`. This also supersedes Decision 6's accepted page-scoped badge count: asking for `?isRead=false&limit=1` and reading `meta.total` yields the exact unread count across all history, so the badge is accurate and no backend count endpoint is needed after all.
