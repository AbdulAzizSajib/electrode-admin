Backend before frontend: the admin work has nothing to poll until the endpoint exists, and both server tasks are additive (see design.md — Migration Plan).

Tasks 1–4 were implemented ahead of this list being written; they are checked to reflect what is on disk, not assumed complete. Group 5 remains.

## 1. Backend — pulse endpoint

- [x] 1.1 Add `IPulse` to `server/src/app/module/analytics/analytics.interface.ts` — latest order (id, number, total, createdAt), order count, pending count, unread notification count, low-stock count, `lastEventAt`.
- [x] 1.2 Add `AnalyticsService.getPulse(userId)` — parallel counts over indexed columns plus one `findFirst` on `createdAt desc`; reuse `SALES_ORDER_WHERE`; unread count scoped to the calling user; low-stock filtered in JS (Prisma cannot compare two columns).
- [x] 1.3 Add `AnalyticsController.getPulse` reading `req.user.userId`, following the `sendResponse` envelope used by the other six handlers.
- [x] 1.4 Register `GET /pulse` on the analytics router, below the existing routes so it inherits `checkAuth(OWNER, ADMIN, STAFF)`.

## 2. Backend — staff notification on order placement

- [x] 2.1 In `order.service.ts` `placeOrder`, call `NotificationService.notifyOwnersAndAdmins` with `NotificationType.ORDER` after the order commits, linking to `/orders/:id`.
- [x] 2.2 Fire it unawaited with an explicit `.catch`, alongside the existing low-stock block, so checkout response time is unaffected.

## 3. Admin — realtime layer

- [x] 3.1 Add `src/lib/api/pulse.ts` — `Pulse` types and `getPulse()` via the shared `requestData` helper.
- [x] 3.2 Add `src/lib/realtime/config.ts` — `PULSE_INTERVAL_MS` (10s) and the mute-state storage key.
- [x] 3.3 Add a `pulse` key and a `dashboard.all` prefix key to `src/lib/api/query-keys.ts`.
- [x] 3.4 Add `useRealtime()` in `src/lib/realtime/use-realtime.ts` — owns the single poll, gated on an authenticated session, `refetchInterval` returning `false` while the tab is hidden, `retry: false` so a failure keeps the last good value.
- [x] 3.5 Add a `visibilitychange` listener that refetches on return, covering the paths window-focus misses.
- [x] 3.6 Invalidate `dashboard.all` when `lastEventAt` changes, skipping the first pulse so a page load does not immediately refetch what it just loaded.
- [x] 3.7 Add `usePulseValue()` — reads the shared key with `enabled: false` so badge consumers never start a second poll.

## 4. Admin — new-order alert and UI wiring

- [x] 4.1 Add `src/lib/realtime/alert-sound.ts` — two-note Web Audio chime, `armAlertSound()` to unlock on a user gesture, all failures swallowed.
- [x] 4.2 Add `useOrderAlert()` and `useOrderAlertSound()` in `src/lib/realtime/use-order-alert.ts` — baseline from the first pulse, one alert per batch sized from `orderCount`, mute state persisted to `localStorage`.
- [x] 4.3 Mount `useRealtime` / `useOrderAlert` once in `ShellLayout`; arm audio from capture-phase pointer and key handlers on the shell.
- [x] 4.4 Add the mute toggle to `Topbar` (state owned by `ShellLayout` and passed down) and read the bell count from the pulse, falling back to the fetched count before the first pulse.
- [x] 4.5 Add the live pending-order badge to the Orders item in `SidebarNav`.
- [x] 4.6 Flip `refetchOnWindowFocus` to `true` in `src/lib/query-client.ts`.
- [x] 4.7 Tests for the two rules most likely to regress: no alert for pre-existing orders on open, and one toast plus one chime for a batch. Plus muted-still-toasts.

## 5. Verification

- [x] 5.1 `npx tsc -b --noEmit` clean in `admin/`; no new errors in `server/` (`auth.ts` has one pre-existing, unrelated).
- [x] 5.2 `npx vitest run` in `admin/` — full suite green.
- [ ] 5.3 Run the stack (`pnpm dev`) and place a storefront order with the dashboard open: confirm the toast, the chime, the pending badge increment, and the stat cards updating within one interval — none of it requiring a refresh.
- [ ] 5.4 Confirm the mute toggle silences the chime, survives a reload, and still shows the toast.
- [ ] 5.5 Confirm a backgrounded tab issues no pulse requests (browser network panel) and catches up immediately on return.
- [ ] 5.6 Confirm signing out stops the polling.
