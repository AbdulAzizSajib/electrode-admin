## Context

See proposal.md — Why. Three facts about the existing system shape everything below.

**The API host cannot hold a connection open.** `server/vercel.json` deploys the whole Express app as one serverless function with `maxDuration: 30`. A stream would be severed at 30 seconds and would occupy an invocation for its entire life; WebSockets are not supported by the platform at all. The team intends to move to Node-capable cPanel hosting later, so a design that only works after that move would leave the problem unsolved until then.

**The admin panel is a Vite + React SPA, not a Next.js app.** It already runs TanStack Query with a shared client (`src/lib/query-client.ts`) and a central key registry (`src/lib/api/query-keys.ts`). Anything periodic is best expressed in terms that client already understands, rather than as a parallel mechanism beside it.

**Order placement currently notifies no staff member.** `NotificationService.notifyOwnersAndAdmins` exists and is used by `stock`, `purchase-order`, and `support-ticket`, but `order.service.ts` only writes customer-facing notifications. This is a gap in its own right, independent of transport: without it there is no staff-visible record of a new order anywhere.

## Goals / Non-Goals

**Goals:**

- One transport that works unchanged on the current host and the future one.
- One request per interval per tab, regardless of how many components display live data.
- A transport seam narrow enough that swapping polling for a stream later touches one file.
- No third-party realtime service, no new infrastructure, no persistent process.

**Non-Goals:**

- Sub-second latency. The unit of urgency here is "before the staff member wanders off", not milliseconds.
- Live updates on every screen. Only the dashboard figures, pending-order badge, and notification count are covered; other screens rely on `refetchOnWindowFocus`.
- Multi-tab coordination. Two tabs open by one person means two polls; at 2–3 staff this is not worth a `BroadcastChannel`.

## Decisions

### 1. Polling, not SSE or WebSocket

**Chosen:** a short-interval `GET /analytics/pulse`.

SSE is the usual answer for one-way server-to-browser updates and would be the right call on a persistent Node process. It is not available here: the 30-second function ceiling turns one logical stream into a reconnect loop, and each open stream pins an invocation, so cost scales with *connected time* rather than with *events*. WebSockets are unavailable on the platform outright.

The alternatives considered and rejected:

- **A managed service (Pusher / Ably / Supabase Realtime).** Solves the host constraint, but adds an external dependency, a second auth surface, and a recurring bill for a 2–3 person admin panel. Disproportionate.
- **Waiting for the cPanel move and doing SSE then.** Leaves the actual complaint unfixed for the whole interim.
- **Postgres `LISTEN`/`NOTIFY`.** Needs a persistent listener, which is exactly what the current host does not provide.

Polling's real cost is requests: ~8,600/day at 10s for three staff over an eight-hour day, comfortably inside the free tier, and it stays correct after the migration. The interval lives in `PULSE_INTERVAL_MS` so it can be retuned in one edit.

### 2. A dedicated cheap endpoint, not polling the existing reports

The six `/analytics/*` reports aggregate over orders, order items, payments, returns and refunds across a date range. Calling those every 10 seconds would be wasteful and would grow more expensive as the shop does.

`/analytics/pulse` instead answers only "has anything changed?" — counts over indexed columns plus one `findFirst` ordered by `createdAt desc`. When its `lastEventAt` changes, the client invalidates the `dashboard` key prefix and the existing report hooks refetch themselves. Heavy queries then run when data actually moved, not on a timer.

This also keeps the six report endpoints untouched.

### 3. One shared query, two hooks

`useRealtime()` owns the poll and is mounted exactly once, in `ShellLayout`. `usePulseValue()` reads the same query key with `enabled: false`, so badge consumers render from whatever the poll last wrote without starting a second one.

The alternative — each consumer calling `useQuery` with its own `refetchInterval` — looks equivalent because React Query dedupes by key, but the interval config is per-observer: three subscribers with their own intervals produce three independent timers on one key. Splitting owner from reader makes the single-request property structural rather than incidental.

Mounting in `ShellLayout` rather than `App` matters: the shell renders behind the auth guard, so the poll starts only for signed-in staff and unmounts when the session ends, instead of hammering a 401 on the sign-in screen.

### 4. Pause on hidden, not merely throttle

`refetchInterval` is a function returning `false` when `document.visibilityState !== 'visible'`, and `refetchIntervalInBackground` is left off. A backgrounded tab therefore costs nothing.

Catch-up on return is deliberately belt-and-braces: `refetchOnWindowFocus` (now enabled globally) covers tab focus, and an explicit `visibilitychange` listener covers the paths focus misses — switching virtual desktops, unminimising, waking a phone. Either alone leaves a case where the user is looking at stale figures.

### 5. Baseline-then-compare for alerts, keyed on order id

The panel records the latest order id from its *first* pulse without alerting. Only a subsequent pulse carrying a different id raises an alert. This is what makes "opening the panel doesn't announce yesterday's orders" and "reloading doesn't re-announce" fall out of the same rule, rather than needing separate suppression logic.

Batch size comes from the difference in `orderCount` between polls, not from assuming one. Three orders between polls produce one toast reading "3 new orders received" and one chime — a burst that produced three stacked toasts and three overlapping chimes would train staff to ignore the alert.

Alerting deliberately keys on the pulse's `latestOrder`, not on the unread-notification count: notifications are also written for stock and support events, so counting them would alert on the wrong things.

### 6. Synthesised chime over an audio asset

Two Web Audio oscillator notes rather than a bundled mp3: nothing added to the bundle, no fetch at the moment it needs to play, nothing to 404. `playOrderAlert()` is the only thing to change if a real sound file is wanted later.

Gain is ramped rather than switched because a gain that jumps to full and back produces an audible click at each edge — it reads as a glitch, not a notification.

### 7. Autoplay handled as expected behavior, not an error

Browsers keep an `AudioContext` suspended until the user has interacted with the page, so a first alert can legitimately arrive with audio still locked. Three things follow:

- Any pointer or key event in the shell calls `armAlertSound()` (capture-phase, so it fires regardless of what handles the event), resuming the context on the first real interaction.
- `playOrderAlert()` on a suspended context calls `resume()` and schedules the notes *in the callback* — scheduling before resume settles would queue notes against a stopped clock, which is the difference between a late burst and silence.
- Every audio failure is swallowed. The toast has already delivered the message; a browser refusing sound must not produce an error the staff member has to dismiss.

### 8. Staff notification on order placement, fired but not awaited

`placeOrder` already has a post-commit block that fires low-stock notifications with `void ... .catch(...)`, explicitly so the storefront's checkout response is not delayed by notification work. The new-order staff notification follows that same pattern for the same reason, and is placed alongside it.

## Risks / Trade-offs

- **Up to one interval of latency; an order can sit unseen for 10 seconds** → Acceptable against the current state, where it sits unseen until someone reloads. Retunable in one constant if 10s proves too slow in practice.
- **Polling continues even when nothing is happening, unlike an event-driven stream** → Bounded and small: the endpoint is counts over indexed columns, and hidden tabs poll not at all.
- **`orderCount`-derived batch size is wrong if an order is cancelled between two polls** (`SALES_ORDER_WHERE` excludes cancelled orders, so the count can fall) → The `Math.max(1, …)` floor keeps the alert truthful about *something* having arrived; the count can understate a batch in that rare window. The alert is a prompt to go look, not a figure anyone acts on.
- **Two tabs open by one staff member double that person's requests** → Left alone deliberately; a cross-tab leader election is more moving parts than the traffic justifies at this scale.
- **`refetchOnWindowFocus: true` is a global default change affecting every screen, not only the dashboard** → That is the intent (screens the pulse doesn't cover still go stale), but it does mean more requests on tab focus across the panel. `staleTime: 30_000` bounds it: a screen focused twice inside 30 seconds refetches once.
- **The pulse's unread count is per-user while `notifyOwnersAndAdmins` writes one row per recipient** → Correct by construction, but it does mean each admin's badge reflects their own reading state. That is the desired behavior, and worth stating because a shared count would look simpler and be wrong.

## Migration Plan

Backend first, since the admin work depends on the endpoint existing:

1. Deploy the server change (`/analytics/pulse` plus the order-placement staff notification). Both are additive — no existing endpoint or response shape changes, so the currently deployed admin panel keeps working untouched.
2. Deploy the admin change.

Rollback is per-side and independent. Reverting the admin panel returns it to manual-refresh behavior while the endpoint sits unused and harmless. Reverting the server leaves the panel polling a 404; the poll's `retry: false` and last-good-value behavior mean it degrades to the same manual-refresh behavior rather than breaking, though it would log failed requests until the panel is reverted too.

No database migration, no schema change, no data backfill. `Notification` rows for new orders simply begin appearing.

### After the move to cPanel

Nothing has to change — polling keeps working on a persistent host. If a stream is wanted then, the seam is `useRealtime()`: it is the only module that knows how pulse data arrives. Consumers read `usePulseValue()` and would not change.
