## Why

After `integrate-categories-api`, `integrate-products-api`, `integrate-orders-api`, `integrate-inventory-api`, and `integrate-post-purchase-api`, 17 of the 30 `src/lib/api/*` modules talk to the real backend — but 13 still return in-memory mock data: `banners.ts`, `campaigns.ts`, `coupons.ts`, `roles.ts`, `permissions.ts`, `staff-users.ts`, `users.ts`, `customers.ts`, `audit-logs.ts`, `notifications.ts`, `store-settings.ts`, and `support-tickets.ts`. Every page under Marketing, Support, Settings, and Customers is therefore showing fabricated data that resets on reload, and several of those mocks model shapes the real backend does not have (a `Banner.position` enum that isn't `BannerPlacement`, a `Coupon.discountType` of `'percentage' | 'fixed'` that isn't `CouponType`, a `Role.permissionIds` array where the backend has a `RolePermission` join). This change finishes the mock-to-real migration: no mock data remains anywhere in the admin panel.

Three of those modules have no backend endpoint to call yet, so this change also closes those server-side gaps rather than leaving four admin pages permanently mock-backed.

## What Changes

Delivered in five dependency-ordered phases; each phase is independently shippable.

### Phase 0 — Shared foundation

- Extract the `request<T>()` helper (currently copy-pasted into each already-migrated module) into `src/lib/api/request.ts`, exporting the `ApiEnvelope<T>` type alongside it, and re-point the existing real modules at it. This is a prerequisite because 11 more modules would otherwise duplicate it a 12th–22nd time.
- **BREAKING** (internal only): delete the mock scaffolding from `src/lib/api/client.ts` — `delay()`, `paginate()`, `generateId()`, and `matchesSearch()` have no consumers once every module is real. `BASE_URL`, `ApiError`, `ListParams`, `PaginationMeta`, and `PaginatedResponse` stay.

### Phase 1 — Low-risk reads (`store-settings`, `audit-logs`, `notifications`)

- `store-settings.ts` → `GET /settings`, `PATCH /settings`. **BREAKING**: the mock's five flat fields become the real `StoreSetting` shape — `taxRate` → `defaultTaxRatePercent`, `currency` gains a paired `currencySymbol`, and the backend adds `contactPhone`, `address`, `logoUrl`, `maxPendingCodOrdersPerPhone`, `maxGuestOrdersPerIpPerHour`, plus the JSON blocks (`mainNav`, `footerColumns`, `socialLinks`, `announcementBar`, `newsletter`). The store-settings page grows sections for the scalar fields; the JSON blocks are read-and-preserve only (see design.md Non-Goals).
- `audit-logs.ts` → `GET /audit-logs`. **BREAKING**: `actorId`/`actorName` become a nested `user` object (nullable — `onDelete: SetNull`), `resourceType` → `entity`, `resourceId` → `entityId`, `action` becomes the `AuditAction` enum, and `resourceLabel` is **dropped** (the backend has no such column; the table shows `entity` + `entityId` instead). The backend also returns `oldData`/`newData` JSON diffs, which the page surfaces in an expandable row.
- **`recordAuditEntry()` is deleted, not migrated.** It is a client-side mock writer; the real backend writes audit entries server-side. Its call sites stop calling it.
- `notifications.ts` → `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`. **BREAKING**: `message` splits into `title` + `message`, `isRead` becomes the backend's read field, `type` becomes the `NotificationType` enum, and a `priority` (`NotificationPriority`) is added. The unread count is derived from the list response rather than a dedicated endpoint (the backend has none — see design.md).

### Phase 2 — Marketing (`banners`, `coupons`, `campaigns`)

- `banners.ts` → `GET /banners/admin`, `GET /banners/admin/:id`, `POST /banners`, `PATCH /banners/:id`, `DELETE /banners/:id`. **BREAKING**, the largest reshape in this change:
  - `imageUrl` → `image` (nullable), plus a new `mobileImage`.
  - `position` (`homepage_hero | homepage_secondary | category_top | checkout_sidebar`) → `placement` (`BannerPlacement`).
  - `isActive: boolean` → `status` (`BannerStatus`: `DRAFT`/etc.) **plus** a `startsAt`/`endsAt` scheduling window the mock had no concept of.
  - `linkUrl` → `link` (nullable), plus an alternative `productId` product link.
  - New presentation fields: `type` (`BannerType`), `subtitle`, `description`, `price`, `discountPrice`, `buttonText`, `bgColor`, `textColor`.
  - **`reorderBanner(id, 'up' | 'down')` is dropped.** The backend exposes `sortOrder` as a plain integer on `PATCH /banners/:id`, with no swap/reorder endpoint; the page edits `sortOrder` directly instead.
  - Create/update post `multipart/form-data` (fields `image`, `mobileImage`, payload under `data`), matching how `brands.ts`/`categories.ts` already handle uploads.
- `coupons.ts` → `POST/GET/PATCH/DELETE /coupons`, `GET /coupons/:id`. **BREAKING**: `discountType` → `type` (`CouponType`), `discountValue` → `value`, `minOrderAmount` → `minimumOrderAmount` (nullable), `isActive` → `status` (`CouponStatus`), `startDate`/`endDate` → `startsAt`/`expiresAt` (both nullable), `usageLimit` becomes nullable; adds `description`, `maximumDiscountAmount`, and `perCustomerLimit`.
- `campaigns.ts` → `POST/GET/PATCH/DELETE /campaigns`, `GET /campaigns/:id`. **BREAKING**: `isActive` → `status` (`CampaignStatus`), `startDate`/`endDate` → `startsAt`/`endsAt` (nullable), `productIds` becomes the `CampaignProduct` relation, and a `placement` (`CampaignPlacement`) is added. **`couponIds` and `metrics` are dropped** — the backend `Campaign` model has no coupon relation and no view/redemption counters; the campaign detail page's metrics panel is removed rather than fabricated.

### Phase 3 — RBAC (`roles`, `permissions`, `staff-users`, `users`) — requires backend work

- `roles.ts` → `POST/GET/PATCH/DELETE /roles`, `POST /roles/:id/permissions`, `DELETE /roles/:id/permissions/:permissionId`. **BREAKING**: `permissionIds: string[]` becomes the backend's `RolePermission` join, so granting/revoking is two distinct endpoint calls rather than one toggle on a role update. All `/roles` and `/permissions` routes are **OWNER-only** (`router.use(checkAuth(RoleName.OWNER))`), so the page gains an OWNER guard.
- `permissions.ts` → `GET /permissions`. **BREAKING**: the mock's `key`/`label`/`category` triple becomes the backend's `name` + nullable `description`; **`category` is dropped**, so the permission picker's grouping is removed (see design.md).
- `staff-users.ts` → `GET /users`, `PATCH /users/:id`. **BREAKING**: `role` becomes `roleId` + a nested `role` object; adds `status` (`UserStatus`), `emailVerified`, `contactNumber`, `image`, `lastLoginAt`.
- `users.ts`'s mock store (`_getAllUsers`, `_getUserById`, `_setUsers`) is deleted; the `UserRole`/`User`/`Address` types it exports move to real backend-shaped types.
- **Backend gaps this phase closes** (in `electrode-server`):
  - `GET /users` currently does `findMany` with no pagination, no search, and no filters — it cannot back a staff-user table. Add `page`/`limit`/`searchTerm`/`roleId`/`status` support returning the standard `meta` envelope.
  - `updateUser` cannot change `roleId` — `IUpdateUserPayload` and `updateUserZodSchema` accept only `name`, `contactNumber`, `image`, `isActive`. Add `roleId` (OWNER-only, validated against an existing role) and `status`, so the admin UI can actually assign roles.

### Phase 4 — Support tickets (`support-tickets`)

- `support-tickets.ts` → `GET /support-tickets`, `GET /support-tickets/:id`, `PATCH /support-tickets/:id`, `GET /support-tickets/:id/messages`, `POST /support-tickets/:id/messages`. **BREAKING**: status/priority become the `TicketStatus`/`TicketPriority` enums (uppercase, not the mock's lowercase strings); adds `ticketNumber`, `description`, `assignedToId`/`assignedTo`; `TicketMessage.authorType`/`authorName` become a nullable nested `sender` user object, and messages gain an `attachments` JSON field.
- Messages move from being embedded in the ticket payload to their own nested endpoint, so the detail page fetches them separately.

### Phase 5 — Customers — requires backend work

- `customers.ts` → a new `GET /customers` + `GET /customers/:id`. **BREAKING**: `name` becomes `firstName`/`lastName`, `joinedAt` → `createdAt`, `isActive` → `status` (`CustomerStatus`), and `email`/`phone` are nullable.
- **Backend gap this phase closes**: the server has **no admin customer endpoint at all** — `/customers/me/addresses` is the only mounted customer route. Add an admin-only `GET /customers` (paginated, searchable by name/email/phone, filterable by status) and `GET /customers/:id` (with addresses and order/spend aggregates), so the Customers list and detail pages have something to call.

## Capabilities

### New Capabilities
- `marketing-management`: banner, coupon, and campaign management against the real backend — including banner placement/scheduling/artwork upload, coupon limit and window semantics, and campaign product association.
- `support-ticket-management`: ticket triage (status, priority, assignment) and the threaded message conversation against the real nested message endpoints.
- `access-control-management`: OWNER-only role and permission administration via the `RolePermission` join, plus staff-user listing and role/status assignment.
- `platform-settings`: store settings, the read-only audit log, and per-user notifications.
- `customer-management`: admin customer listing and customer detail (addresses, order history, spend), backed by new admin customer endpoints.

### Modified Capabilities
(none — no existing spec under `openspec/specs/` changes; this repo's specs directory holds no published capabilities yet.)

## Impact

- **Code (`electrode-admin`)**:
  - New: `src/lib/api/request.ts`.
  - Rewritten mock → real: `src/lib/api/banners.ts`, `campaigns.ts`, `coupons.ts`, `roles.ts`, `permissions.ts`, `staff-users.ts`, `users.ts`, `customers.ts`, `audit-logs.ts`, `notifications.ts`, `store-settings.ts`, `support-tickets.ts`.
  - Trimmed: `src/lib/api/client.ts` (mock helpers removed); the 17 already-real modules re-point at the shared `request.ts`.
  - Pages updated for reshaped types: `src/features/marketing/banners/banners-page.tsx`, `marketing/coupons/coupons-page.tsx`, `marketing/campaigns/campaigns-list-page.tsx`, `campaign-detail-page.tsx`, `settings/roles-permissions/roles-permissions-page.tsx`, `settings/audit-logs/audit-logs-page.tsx`, `settings/store-settings/store-settings-page.tsx`, `customers/customers/customers-list-page.tsx`, `customer-detail-page.tsx`, `customers/staff-users/staff-users-page.tsx`, `support/tickets/support-tickets-list-page.tsx`, `support-ticket-detail-page.tsx`, `support/notifications/notifications-page.tsx`, and `src/components/layout/topbar.tsx` (unread notification badge).
  - `src/lib/api/query-keys.ts` gains keys for the newly real resources.
- **Code (`electrode-server`) — this change spans two repositories.** The admin repo's OpenSpec `allowedEditRoots` covers `electrode-admin` only, so the backend edits in Phases 3 and 5 are performed in `D:\Next.js\electrode\electrode-server` and tracked here as explicit cross-repo tasks:
  - `src/app/module/user/user.service.ts`, `user.interface.ts`, `user.validation.ts` — pagination/search/filters on `GET /users`; `roleId`/`status` on `updateUser`.
  - `src/app/module/customer/` — new admin `GET /customers` and `GET /customers/:id` (controller, service, validation, route), mounted at `/customers` in `src/app/routes/index.ts` alongside the existing `/customers/me/addresses`.
- **Backend dependency**: `{{base_url}}/banners`, `/coupons`, `/campaigns`, `/roles`, `/permissions`, `/users`, `/customers`, `/audit-logs`, `/notifications`, `/settings`, `/support-tickets` must be reachable.
- **Authorization**: `/roles` and `/permissions` are OWNER-only; `/audit-logs`, `/settings`, `/banners/admin`, `/coupons`, `/campaigns`, and `/users` are OWNER/ADMIN; `/support-tickets` reads are open to all roles with OWNER/ADMIN/STAFF required to update. The admin nav and route guards must reflect this so a STAFF session is not shown pages that will 403.
- **Removals that affect other modules**: `recordAuditEntry()` (mock-only audit writer) and the `client.ts` mock helpers are deleted; every call site is updated in the same phase.
