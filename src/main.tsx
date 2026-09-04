import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import './index.css'
import App from './App.tsx'
import { queryClient } from '@/lib/query-client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { antdTheme } from '@/lib/antd-theme'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={antdTheme}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
)
