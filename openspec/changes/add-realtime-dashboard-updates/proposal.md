## Why

When a customer places an order — from the storefront or a landing page — nothing in the admin panel reacts. Every dashboard query in `src/lib/api/dashboard.ts` is a plain `useQuery` with no `refetchInterval`, and the shared client in `src/lib/query-client.ts` sets `staleTime: 30_000` with `refetchOnWindowFocus: false`. So a staff member watching the dashboard sees a frozen snapshot: new orders, pending counts, and stock alerts only appear on a manual browser refresh. Orders sit unnoticed until someone thinks to reload.

Two facts shape the solution:

- **The API server is deployed to Vercel as a serverless function** (`server/vercel.json`, `functions."api/index.js".maxDuration: 30`). Long-lived connections are not viable there — an SSE stream would be killed at the 30-second ceiling and would hold an invocation open for its whole life. WebSockets do not work at all. The team plans to move to Node-capable cPanel hosting later, so the transport must be swappable without rewriting the dashboard.
- **Order placement notifies no staff member today.** `NotificationService.notifyOwnersAndAdmins` exists and is used by `purchase-order`, `stock`, and `support-ticket`, but `order.service.ts` only calls `createNotification` targeting the *customer* (order confirmation, cancellation). No staff-facing record of a new order is ever written.

This change makes the admin dashboard update itself on a short interval, and alerts staff — visually and audibly — the moment an order arrives.

## What Changes

- **New backend endpoint `GET /api/v1/analytics/pulse`** — a deliberately cheap "has anything changed?" probe returning a small fixed-shape payload (latest order id/number/total, order and pending counts, unread notification count, low-stock count, and a `lastEventAt` timestamp). Mounted on the existing `analytics` router, so it inherits that router's `checkAuth(OWNER, ADMIN, STAFF)` guard. It is a counts-and-max query over indexed columns, not an aggregate report — it is safe to call every few seconds, unlike the six existing dashboard endpoints.
- **New staff notification on order placement** — `order.service.ts` calls `NotificationService.notifyOwnersAndAdmins` when an order is created, matching the existing pattern in `stock.service.ts`. This is what makes a new order visible to staff at all, independent of polling.
- **New `useRealtime()` hook in the admin panel** — owns a single poll of `/analytics/pulse` on a shared interval and exposes the result to the whole app. Every consumer reads from this one hook; there is exactly one in-flight pulse request regardless of how many components subscribe.
- **Polling is visibility-aware** — the interval pauses while the browser tab is hidden and resumes (with an immediate fetch) when it becomes visible again, so a backgrounded tab costs nothing and a returning user sees current data at once.
- **Interval lives in one exported constant** (`PULSE_INTERVAL_MS`, initially 10 seconds) so it can be tuned in a single edit.
- **Detected changes invalidate the heavy dashboard queries** rather than refetching them on their own timers — the six existing `useDashboard*` hooks keep their current shape, and the pulse decides when their data is stale.
- **New-order alert** — when the pulse reports an order newer than the last one seen, staff get a toast (via the existing `use-toast`) and a sound. The sound is synthesized with the Web Audio API, so no audio asset is added to the bundle.
- **Sound is user-controllable and autoplay-safe** — a mute toggle in the topbar persists to `localStorage`; browsers block audio before a user gesture, so playback is armed on first interaction and failure degrades silently to the toast alone.
- **Sidebar pending-order badge and notification-bell count** read live from the same pulse.
- **`refetchOnWindowFocus` becomes `true`** in `src/lib/query-client.ts`, so returning to the tab refreshes data that the pulse does not cover.

Deliberately **not** in scope: SSE or WebSocket transport (unusable on the current host — see design.md for the swap path), push notifications, and any change to the six existing analytics endpoints.

## Capabilities

### New Capabilities
- `realtime-dashboard`: how the admin panel keeps dashboard and navigation data current without a manual refresh — the polling contract, its pause/resume behavior, what data is covered, and how staleness propagates to the heavier dashboard queries.
- `new-order-alerts`: how staff are alerted to a newly placed order — toast and sound, the mute toggle and its persistence, autoplay-block degradation, and the rules preventing spurious or repeated alerts.

### Modified Capabilities
(none — the admin panel has no existing capability specs under `openspec/specs/`, and the two behaviors above are new. The backend's `api/support-and-admin` spec lives in a separate OpenSpec root (`server/openspec/`) and is not edited by this change; the server-side work is tracked in this change's tasks.md.)

## Impact

- **Admin — new**: `src/lib/realtime/config.ts` (interval constant), `src/lib/realtime/use-realtime.ts` (the poll), `src/lib/realtime/use-order-alert.ts` (toast + sound + last-seen tracking), `src/lib/realtime/alert-sound.ts` (Web Audio chime), `src/lib/api/pulse.ts` (fetch + types, following the established `request<T>()` envelope pattern).
- **Admin — modified**: `src/lib/query-client.ts` (`refetchOnWindowFocus: true`); `src/App.tsx` or `src/components/layout/shell-layout.tsx` (mount the poll once, inside the authenticated shell); `src/components/layout/topbar.tsx` (mute toggle, bell count); `src/components/layout/sidebar-nav.tsx` (pending badge).
- **Server — new**: `analytics.route.ts` (one route), `analytics.controller.ts` + `analytics.service.ts` (the pulse query), `analytics.interface.ts` (response type).
- **Server — modified**: `order.service.ts` — add the `notifyOwnersAndAdmins` call on order creation.
- **Cross-root dependency**: the admin work depends on the server endpoint existing. Both are sequenced in this change's tasks.md, backend first.
- **Deployment**: no new infrastructure, no third-party realtime service, no persistent process required — the design works unchanged on Vercel today and on cPanel later.
- **Cost**: at a 10-second interval with 2–3 concurrent staff, roughly 8,600 requests/day, well inside Vercel's free-tier invocation budget. Halving the interval to 5 seconds doubles that and remains within budget.
- **Unrelated cleanup noted, not done here**: `node-cron` is a declared dependency in `server/package.json` but its only use is a commented-out block in `app.ts:52-59` referencing `AppointmentService` — leftover from an unrelated project. Cron is server-side scheduling and cannot deliver data to a browser, so it is not part of this solution; removing the dead code is out of scope.
