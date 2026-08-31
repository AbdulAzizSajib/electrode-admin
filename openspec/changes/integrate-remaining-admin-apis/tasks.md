Tasks are grouped by the phases in proposal.md. Each group is independently shippable.

**Repo prefixes** — this change spans two trees (design.md, Decision 8):
- `[admin]` → `D:\Next.js\electrode\electrode-admin`
- `[server]` → `D:\Next.js\electrode\electrode-server`

Tasks with no prefix are `[admin]`.

## 1. Phase 0 — Shared request helper

- [x] 1.1 Create `src/lib/api/request.ts` exporting `ApiEnvelope<T>` and `request<T>(path, init?)`, lifted from the copy in `src/lib/api/brands.ts` (keeps `credentials: 'include'`, envelope unwrapping, and `ApiError` on `!res.ok || !json.success`)
- [x] 1.2 In `request.ts`, set `'Content-Type': 'application/json'` **only when `init.body` is not a `FormData`** (design.md Decision 7) — the existing copies hardcode it, which would break multipart uploads
- [x] 1.3 Re-point all 17 already-real modules (`auth`, `brands`, `categories`, `dashboard`, `orders`, `payments`, `products`, `purchase-orders`, `refunds`, `returns`, `reviews`, `shipments`, `shipping-methods`, `stock`, `stock-movements`, `suppliers`, `warehouses`) at the shared helper and delete their private `request`/`ApiEnvelope` copies
- [x] 1.4 Verify no behavior change: brand logo upload (multipart) and the product list (plain JSON) both still work against a running backend
- [x] 1.5 Rewrite the header comment in `src/lib/api/client.ts` — it currently describes the module as "the mock API layer" awaiting "a future API-integration change"

## 1b. Phase 0 — Brand and category image upload

Added mid-implementation at the user's request. The backend has accepted multipart on these
routes all along (`brandLogoUpload` in `brand.route.ts`, `categoryImageUpload` in
`category.route.ts`), but the admin panel only ever sent pre-hosted URL strings, so there was no
way to upload artwork from the create/edit forms. Unblocked by task 1.2's `FormData` support.

- [x] 1b.1 Add a single-image picker component for the brand/category forms, following the existing `src/features/catalog/products/components/image-upload-field.tsx` pattern (object-URL preview, revoke on replace/unmount) but for one file rather than a list with alt-text/primary metadata
- [x] 1b.2 Extend `src/lib/api/brands.ts` `createBrand`/`updateBrand` to send `multipart/form-data` with the `logo` file field and the payload under `data` when a file is picked, and keep sending plain JSON when it is not (the backend accepts both)
- [x] 1b.3 Extend `src/lib/api/categories.ts` `createCategory`/`updateCategory` the same way for its two file fields, `image` and `banner`
- [x] 1b.4 Add the picker to `src/features/catalog/brands/brand-form-modal.tsx` alongside the existing Logo URL input, in both the create and edit modals, showing the current logo when editing
- [x] 1b.5 Add the picker to the category form for both `image` and `banner`, showing the current artwork when editing
- [x] 1b.6 Verify: create a brand with an uploaded logo; edit a brand and replace its logo; create a brand with a URL instead of a file and confirm that still works; same three for a category's image and banner

## 2. Phase 1 — Store settings

- [x] 2.1 Rewrite `src/lib/api/store-settings.ts` against `GET /settings` and `PATCH /settings`, with `StoreSettings` matching the backend `StoreSetting` model (`storeName`, `currency`, `currencySymbol`, `defaultTaxRatePercent`, `freeShippingThreshold`, `contactEmail`, `contactPhone`, `address`, `logoUrl`, `maxPendingCodOrdersPerPhone`, `maxGuestOrdersPerIpPerHour`), preserving nullability per design.md Decision 10
- [x] 2.2 Type the JSON config blocks (`mainNav`, `footerColumns`, `socialLinks`, `announcementBar`, `newsletter`) as opaque and round-trip them unchanged on save, so the settings page cannot erase them (spec: Preservation of Unedited Settings)
- [x] 2.3 Update `src/features/settings/store-settings/store-settings-page.tsx` for the reshaped fields, adding inputs for the new scalar settings and keeping the JSON blocks out of the form
- [x] 2.4 Verify: change the tax rate, reload, and confirm it persisted; clear the free-shipping threshold and confirm it saves as unset; save on a store with populated nav/footer config and confirm that config survives

## 3. Phase 1 — Audit log

- [x] 3.1 Rewrite `src/lib/api/audit-logs.ts` against `GET /audit-logs`, with `AuditLogEntry` matching the backend `AuditLog` model (nested nullable `user`, `action` as the `AuditAction` enum, `entity`, `entityId`, `oldData`, `newData`, `ipAddress`, `userAgent`, `createdAt`); drop `resourceLabel`
- [x] 3.2 Support the action, entity, and date-range filters and server-side pagination, mapping `ListParams.search` → `searchTerm`
  - `[server]` The date range needed a one-line backend fix, applied here: `audit-log.service.ts` declared `filterableFields: ["entity", "entityId", "action", "userId"]`, and `QueryBuilder.filter()` drops any param outside that list (`if (!isAllowedField) return`) — so `createdAt[gte]` was *silently ignored*, returning the unfiltered trail while appearing to filter. Added `"createdAt"` to the list. Verified that Express's `qs` parser turns `createdAt[gte]=…` into the nested object `parseRangeFilter` expects, and that ISO strings pass through uncoerced for Prisma.
  - `to` is sent as end-of-day so a same-day range is inclusive rather than matching only midnight-stamped rows.
  - **Not supported and not attempted:** `searchTerm` — the service declares no `searchableFields`, so free-text search over audit entries has no backend behaviour to call. The page offers no search box.
- [x] 3.3 **Delete `recordAuditEntry`** and its call sites (design.md Decision 3 — safe here because they are all still mock modules at this point). Note: there were **six**, not the five the plan listed — `support-tickets.ts` also called it, and is included.
- [x] 3.4 Update `src/features/settings/audit-logs/audit-logs-page.tsx`: show `entity` + `entityId` in place of `resourceLabel`, render an unknown-user label when `user` is null, and add an expandable row showing `oldData`/`newData` with an explicit empty state when both are absent
- [x] 3.5 Verify: filter by action and by date range and confirm the requests round-trip to the backend; confirm the page is read-only (no create/edit/delete affordance)

## 4. Phase 1 — Notifications

- [x] 4.1 Confirm whether `GET /notifications` accepts an `isRead` filter (design.md Open Question 2); use the server-side filter if it exists, otherwise filter the fetched page client-side
- [x] 4.2 Rewrite `src/lib/api/notifications.ts` against `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, with `AppNotification` matching the backend model (`type` as `NotificationType`, `priority` as `NotificationPriority`, split `title` + `message`, `link`, `isRead`, `readAt`, `channel`, `createdAt`)
- [x] 4.3 Derive the unread count from the notification list query rather than a dedicated endpoint (design.md Decision 6 — none exists)
- [x] 4.4 Update `src/features/support/notifications/notifications-page.tsx` for the reshaped type, including the read-state filter
- [x] 4.5 Update the unread badge in `src/components/layout/topbar.tsx` to use the derived count, showing no badge at zero
- [x] 4.6 Verify: mark one notification read and confirm the badge decrements; mark all read and confirm the badge clears; reload and confirm both persisted

## 5. Phase 2 — Banners

- [x] 5.1 Rewrite `src/lib/api/banners.ts` against `GET /banners/admin`, `GET /banners/admin/:id`, `POST /banners`, `PATCH /banners/:id`, `DELETE /banners/:id`
- [x] 5.2 Reshape `Banner` to the backend model: `image`/`mobileImage` (nullable), `placement` (`BannerPlacement`), `status` (`BannerStatus`), `type` (`BannerType`), `startsAt`/`endsAt`, `link` (nullable), `productId`, `sortOrder`, and the presentation fields `subtitle`, `description`, `price`, `discountPrice`, `buttonText`, `bgColor`, `textColor`
- [x] 5.3 Define `BannerPlacement`, `BannerStatus`, and `BannerType` as `const` arrays and derive both the TS unions and the UI option lists from them (design.md Risks — stale enum literals fail silently)
- [x] 5.4 Send create/update as `multipart/form-data` with `image` and `mobileImage` file fields and the payload under `data`, matching `brands.ts`/`categories.ts`
- [x] 5.5 **Delete `reorderBanner`/`useReorderBanner`** and `toggleBannerActive`/`useToggleBannerActive`; sort order becomes a directly editable numeric field and active-state becomes the `status` select (design.md Decision 5)
- [x] 5.6 Update `src/features/marketing/banners/banners-page.tsx`: placement and status filters, artwork upload for both images, the scheduling window, the URL-or-product link choice, and the editable sort order
- [x] 5.7 **Verified in a real browser. Caught and fixed a crash here:** the banner sheet threw `useFormField must be used within <FormField>` and rendered nothing — the artwork pickers were wrapped in bare `<FormItem>/<FormLabel>`, which call `useFormField()` and require a `FormField` ancestor. The picked file is component state, not a form field, so those wrappers became plain markup. Typecheck could not catch this (it is a runtime context error); only opening the sheet did. Original checklist: create a banner with both images; create one with no artwork; set a start/end window; leave the end time empty and confirm it saves as open-ended; reload and confirm all persisted

## 6. Phase 2 — Coupons

- [x] 6.1 Rewrite `src/lib/api/coupons.ts` against `POST /coupons`, `GET /coupons`, `GET /coupons/:id`, `PATCH /coupons/:id`, `DELETE /coupons/:id`
- [x] 6.2 Reshape `Coupon`: `type` (`CouponType`: `PERCENTAGE`/`FIXED`/`FREE_SHIPPING`), `value`, `status` (`CouponStatus`), `minimumOrderAmount`, `maximumDiscountAmount`, `usageLimit`, `perCustomerLimit` (all nullable), `startsAt`/`expiresAt` (nullable), `description`, and read-only `usageCount`
- [x] 6.3 Define `CouponType`/`CouponStatus` as `const` arrays driving both the unions and the UI options
- [x] 6.4 Update `src/features/marketing/coupons/coupons-page.tsx` for the reshaped fields, presenting `usageCount` as read-only and supporting empty (unlimited) usage limits
- [x] 6.5 Verify: create a percentage coupon with a minimum order amount; create one with no usage limit; submit a duplicate code and confirm the backend's message is shown

## 7. Phase 2 — Campaigns

- [x] 7.1 Rewrite `src/lib/api/campaigns.ts` against `POST /campaigns`, `GET /campaigns`, `GET /campaigns/:id`, `PATCH /campaigns/:id`, `DELETE /campaigns/:id`
- [x] 7.2 Reshape `Campaign`: `status` (`CampaignStatus`), `placement` (`CampaignPlacement`, nullable), `startsAt`/`endsAt` (nullable), `description` (nullable), and products via the `CampaignProduct` relation
- [x] 7.3 **Drop `couponIds` and `metrics`** — the backend model has neither (design.md Decision 5)
- [x] 7.4 Update `src/features/marketing/campaigns/campaigns-list-page.tsx` and `campaign-detail-page.tsx`: status/placement controls, product association, removal of the metrics panel and the coupon association control, and an empty state for a campaign with no products
- [x] 7.5 Verify: create a scheduled campaign with a window; associate two products and confirm they appear on detail after reload; open a campaign with no products and confirm the empty state

## 8. Phase 3 — Backend user endpoint gaps `[server]`

- [x] 8.1 `[server]` Extend `getAllUsers` in `src/app/module/user/user.service.ts` to accept `page`, `limit`, `searchTerm` (name/email), `roleId`, and `status`, returning the project's standard paginated `meta` envelope — it is currently an unpaginated, unfiltered `findMany`
- [x] 8.2 `[server]` Add `roleId` and `status` to `IUpdateUserPayload` (`src/app/module/user/user.interface.ts`) and `updateUserZodSchema` (`user.validation.ts`); leave `updateOwnProfileZodSchema` untouched
- [x] 8.3 `[server]` Validate that `roleId` references an existing `Role`, returning a clear 400 when it does not
- [x] 8.4 `[server]` **Gate `roleId` changes to OWNER only** — an ADMIN must not be able to reassign roles, or `/roles` being OWNER-only is bypassable through this endpoint (design.md Decision 8; highest-severity item in this change)
- [x] 8.5 `[server]` Verify by hand: paginated/searched/filtered `GET /users` returns correct `meta`; an OWNER can change a user's `roleId`; an ADMIN attempting the same is rejected
  - **Verified against the live database** (via a throwaway script driving QueryBuilder with the service's own config): pagination returns `{page:1,limit:2,total:6,totalPages:3}` with 2 rows; `searchTerm` with no match returns 0; `roleId` filter narrows 6 → 1; `status=ACTIVE` filter applies; the `role` relation is included on each row.
  - **STILL UNVERIFIED — needs an authenticated session:** the OWNER-only `roleId` gate (an ADMIN being rejected). The logic is in `UserService.updateUser` and typechecks, but it has not been exercised end-to-end. This is the highest-severity item in the change; exercise it before relying on it.

## 9. Phase 3 — RBAC modules (all four migrate together)

- [x] 9.1 Read the seeded `Permission` rows to learn their `name` format before writing the permission UI (design.md Open Question 1)
- [x] 9.2 Rewrite `src/lib/api/permissions.ts` against `GET /permissions` with `Permission` as `{ id, name, description | null, createdAt }`; drop `category` and `key`/`label`, and delete `_getAllPermissions`
- [x] 9.3 Rewrite `src/lib/api/roles.ts` against `POST/GET/PATCH/DELETE /roles`, `GET /roles/:id`, `POST /roles/:id/permissions`, `DELETE /roles/:id/permissions/:permissionId`; `Role` becomes `{ id, name, description | null, permissions, createdAt, updatedAt }` sourced from the `RolePermission` join
- [x] 9.4 Make grant and revoke two distinct operations that refetch the role afterward, rather than one local toggle (spec: Granting and Revoking Role Permissions)
- [x] 9.5 **Delete `_isRoleInUse`** and its client-side 409 pre-check; surface the backend's conflict message on delete instead (design.md Decision 4)
- [x] 9.6 Rewrite `src/lib/api/users.ts`: remove the mock store and `_getAllUsers`/`_getUserById`/`_setUsers`; keep only backend-shaped `User` types (`roleId` + nested `role`, `status` as `UserStatus`, `emailVerified`, `contactNumber`, `image`, `lastLoginAt`, `isActive`)
- [x] 9.7 Rewrite `src/lib/api/staff-users.ts` against `GET /users` and `PATCH /users/:id` with server-side pagination, search, and role/status filters
- [x] 9.8 Update `src/features/settings/roles-permissions/roles-permissions-page.tsx` for the join-based permissions and the ungrouped permission list
- [x] 9.9 Update `src/features/customers/staff-users/staff-users-page.tsx` for the reshaped user, including a never-signed-in indicator when `lastLoginAt` is null
- [x] 9.10 Add the OWNER-only guard and nav visibility for roles & permissions, and set required roles for the other newly-integrated pages (design.md Decision 9)
- [x] 9.11 Verify: a STAFF session sees no Roles & Permissions nav entry and cannot route to it; grant/revoke persists across reload; deleting an in-use role shows the backend's message; searching and filtering staff users round-trips to the backend

## 10. Phase 4 — Support tickets

- [x] 10.1 Rewrite `src/lib/api/support-tickets.ts` against `GET /support-tickets`, `GET /support-tickets/:id`, `PATCH /support-tickets/:id`, `GET /support-tickets/:id/messages`, `POST /support-tickets/:id/messages`; delete its `_getAllUsers()` dependency
- [x] 10.2 Reshape `SupportTicket`: `ticketNumber`, `description`, `status` (`TicketStatus`), `priority` (`TicketPriority`), `customerId`/`customer`, `assignedToId`/`assignedTo` (nullable)
- [x] 10.3 Reshape `TicketMessage`: nullable nested `sender` replacing `authorType`/`authorName`, plus `attachments`
- [x] 10.4 Fetch messages via the nested endpoint as a separate query from the ticket, and invalidate it after posting a reply
- [x] 10.5 Update `src/features/support/tickets/support-tickets-list-page.tsx` for the uppercase enums, status/priority filters, and an explicit unassigned indicator
- [x] 10.6 Update `support-ticket-detail-page.tsx` for the separate message query, an unknown-sender label for messages whose sender is null, and an empty-conversation state
- [x] 10.7 Verify: filter by status; post a reply and confirm it appears without a manual reload; change status and priority and confirm both persist; confirm a rejected triage attempt surfaces the backend's message

## 11. Phase 5 — Backend customer endpoints `[server]`

- [x] 11.1 `[server]` Add an admin-only `GET /customers` in `src/app/module/customer/` — paginated, searchable across name/email/phone, filterable by `status` — with controller, service, and validation following the module conventions used by the other admin list endpoints
- [x] 11.2 `[server]` Add `GET /customers/:id` returning the customer with `addresses` and server-computed order count and total spent (a Prisma aggregate — not a client-side sum over a paginated order list)
- [x] 11.3 `[server]` Guard both routes with `checkAuth(RoleName.OWNER, RoleName.ADMIN)`
- [x] 11.4 `[server]` Mount the new router at `/customers` in `src/app/routes/index.ts` **after** the existing `/customers/me/addresses` mount, so `/customers/:id` cannot capture the literal `me` segment (design.md Decision 8)
- [x] 11.5 `[server]` **Verified against the live database and running server.** Route mounting: `/customers/me/addresses` returns 401 (route found, auth required) rather than 404, so `/customers/:id` is not shadowing the literal `me` segment; `/customers` and `/customers/:id` both resolve. Service layer: list returns `{page:1,limit:3,total:17,totalPages:6}`, a no-match `searchTerm` returns 0, detail returns addresses plus `orderCount`/`totalSpent`, the aggregate cross-checks exactly against a direct sum over non-cancelled orders (159.99), and an unknown id throws "Customer not found". Original checklist: `/customers/me/addresses` still resolves correctly after mounting; the list paginates, searches, and filters; the detail returns correct aggregates for a customer with orders and zeros for one without

## 12. Phase 5 — Customers module

- [x] 12.1 Rewrite `src/lib/api/customers.ts` against the new `GET /customers` and `GET /customers/:id`; delete its `_getAllUsers`/`_getUserById` dependency
- [x] 12.2 Reshape `CustomerRow`/`CustomerDetail`: `firstName`/`lastName` replacing `name`, nullable `email`/`phone`, `status` (`CustomerStatus`), `createdAt` replacing `joinedAt`, plus backend-reported `orderCount` and `totalSpent`
- [x] 12.3 Update `src/features/customers/customers/customers-list-page.tsx` for server-side pagination/search, the status filter, and explicit empty indicators for missing email/phone
- [x] 12.4 Update `customer-detail-page.tsx` for the reshaped customer, the address list with a default marker and empty state, the backend-reported purchase totals, and a not-found state
- [x] 12.5 Verify: search by email and by phone; filter by status; open a customer with no addresses and one who has never ordered and confirm both render their empty states

## 13. Cleanup and final verification

- [x] 13.1 Delete `delay`, `paginate`, `generateId`, and `matchesSearch` from `src/lib/api/client.ts`, keeping `BASE_URL`, `ApiError`, `ListParams`, `PaginationMeta`, `PaginatedResponse`
- [x] 13.2 Confirm no mock remnants remain: `grep` across `src/` finds no `delay(`, `generateId(`, `matchesSearch(`, `recordAuditEntry`, or any `_`-prefixed cross-module mock accessor
- [x] 13.3 Add query keys for every newly-real resource to `src/lib/api/query-keys.ts` and confirm each mutation invalidates the right ones
- [x] 13.4 Run the project's lint and typecheck and fix any fallout from the reshaped types
- [x] 13.5 Walk every migrated page against a running backend and confirm each one's mutations survive a page reload — the definitive mock-vs-real check
