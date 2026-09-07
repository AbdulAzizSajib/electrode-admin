import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client. Query functions in `src/lib/api/*` currently read/write an
 * in-memory mock store; a future API-integration change swaps their implementation for
 * real `fetch` calls without touching this client or any call site.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      /*
       * On, so returning to the tab refreshes what the live pulse doesn't cover (see
       * `src/lib/realtime/`). The pulse keeps dashboard figures, the pending badge and the
       * notification count current on an interval; every other screen — an order list left
       * open, a stock page — would otherwise still show whatever it held when the user
       * switched away.
       */
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
