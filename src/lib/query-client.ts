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
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
