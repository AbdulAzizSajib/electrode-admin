import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from '@/lib/query-client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { AdminFontProvider } from '@/features/ui/fonts/admin-font-provider'

/**
 * A data router, not `<BrowserRouter>`.
 *
 * `useBlocker` — what keeps the Header Links and Footer Links editors from
 * dropping unsaved edits when you navigate away — throws outside a data router,
 * which took both of those pages down with a blank screen. The single splat
 * route hands everything straight back to the `<Routes>` tree in
 * `app-router.tsx`, so route definitions stay where they are.
 */
const router = createBrowserRouter([{ path: '*', element: <App /> }])

/*
 * AdminFontProvider is INSIDE QueryClientProvider, not outside it.
 *
 * It reads the panel's typeface from the settings query, so it needs a query
 * client in scope. Everything under it renders on the fallback stack until that
 * query resolves, which is deliberate — see `AdminFontProvider`.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminFontProvider>
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </AdminFontProvider>
    </QueryClientProvider>
  </StrictMode>,
)
