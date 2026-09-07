/**
 * The panel's single live poll.
 *
 * Every live element — dashboard figures, the pending-order badge, the notification count —
 * reads from this one query. React Query dedupes by key, so N subscribers still mean one
 * in-flight request per interval; components must never poll `/analytics/pulse` themselves.
 *
 * Why polling rather than SSE or a socket: the API is deployed as a serverless function with a
 * 30s ceiling (`server/vercel.json`), which kills a long-lived stream mid-connection and holds
 * an invocation open for its whole life. Polling costs one short request per interval and works
 * unchanged on the Node host the project moves to later — at which point only this file needs
 * to change to swap in a stream, because nothing above it knows how the data arrives.
 */
import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPulse, type Pulse } from '@/lib/api/pulse'
import { queryKeys } from '@/lib/api/query-keys'
import { PULSE_INTERVAL_MS } from '@/lib/realtime/config'
import { useSessionStore } from '@/lib/store/session-store'

/**
 * Mounted once, in the authenticated shell. Returns the latest pulse, or `undefined` before the
 * first one resolves.
 *
 * Polling is gated on there being a signed-in user so it never runs on the sign-in screen, and
 * stops when the session ends rather than retrying a request that will now 401 forever.
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const isAuthenticated = Boolean(useSessionStore((s) => s.user))

  const query = useQuery({
    queryKey: queryKeys.pulse,
    queryFn: getPulse,
    enabled: isAuthenticated,
    /*
     * `false` while hidden is what pauses the poll in a background tab; React Query re-reads
     * this on visibility change, and `refetchIntervalInBackground` stays off so a hidden tab
     * costs nothing. The immediate catch-up fetch on return comes from `refetchOnWindowFocus`
     * (enabled globally in query-client.ts) plus the visibilitychange handler below.
     */
    refetchInterval: () => (document.visibilityState === 'visible' ? PULSE_INTERVAL_MS : false),
    /*
     * A failed pulse must never blank the panel or interrupt anyone: keep serving the last good
     * value, stay quiet, and let the next tick recover. `retry: false` because the interval is
     * already a retry — stacking React Query's backoff on top would pile requests on an API
     * that is evidently struggling.
     */
    retry: false,
    staleTime: 0,
    gcTime: Infinity,
  })

  /*
   * The heavy `/analytics/*` reports stay on their own keys with no interval of their own; this
   * is what makes them live. Re-fetching them only when the pulse says something actually moved
   * keeps six aggregate queries off a 10s timer while still never showing stale figures — and
   * invalidating by the `dashboard` prefix refreshes whichever date range is on screen.
   */
  const lastEventAt = query.data?.lastEventAt ?? null
  const lastAppliedEvent = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (lastAppliedEvent.current === undefined) {
      // First pulse establishes the baseline; the dashboard has just loaded its own data.
      lastAppliedEvent.current = lastEventAt
      return
    }

    if (lastAppliedEvent.current === lastEventAt) return

    lastAppliedEvent.current = lastEventAt
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }, [lastEventAt, queryClient])

  /*
   * `refetchOnWindowFocus` covers tab focus but not every path back to visibility (switching
   * desktops, unminimising, waking a phone). Refetching here as well makes "the data is current
   * the moment you can see it" hold in those cases too.
   */
  useEffect(() => {
    if (!isAuthenticated) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pulse })
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAuthenticated, queryClient])

  return query.data as Pulse | undefined
}

/**
 * Reads the shared pulse without subscribing to the poll itself.
 *
 * For consumers that only display a figure (badges, counts). They render from whatever the
 * shell's poll last wrote; they never start a second one, because `useQuery` here would attach
 * to the same key but with its own interval config.
 */
export function usePulseValue(): Pulse | undefined {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.pulse,
    queryFn: getPulse,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  return query.data ?? queryClient.getQueryData<Pulse>(queryKeys.pulse)
}
