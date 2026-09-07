/**
 * Real backend dashboard-summary call — follows the same envelope/error pattern as
 * `categories.ts`/`products.ts`. Backed by a new `GET /analytics/dashboard` endpoint added
 * specifically for this (see `server/openspec/changes/add-dashboard-analytics-api`) — there was no
 * existing endpoint to swap to, unlike every other mock-to-real migration in this roadmap.
 *
 * `customersTrend`/`lowStockTrend` don't exist in the response: the backend computes real
 * percentage trends for revenue/orders (against the immediately preceding period of equal length)
 * but has no time-series basis for total-customer-count or low-stock-count, so it doesn't fabricate
 * one — `DashboardSummary.kpis` only has `revenueTrend`/`ordersTrend`.
 *
 * `useTopProducts` is backed by `server/openspec/changes/add-analytics-reports-api` — same `range`
 * param, same envelope, same `api/analytics` capability, just another `GET /analytics/*` route
 * alongside `/dashboard`. The other routes from that change (sales-by-category,
 * order-status-breakdown, payment-breakdown, returns-refunds) still exist server-side but the
 * dashboard no longer surfaces them; deeper breakdowns live under `/reports` (`reports.ts`).
 */
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export type DashboardRange = '7d' | '30d' | '90d'

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface DashboardSummary {
  kpis: {
    totalRevenue: number
    revenueTrend: number
    totalOrders: number
    ordersTrend: number
    totalCustomers: number
    lowStockCount: number
  }
  revenueSeries: TimeSeriesPoint[]
  ordersSeries: TimeSeriesPoint[]
  recentOrders: Array<{ id: string; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }>
  lowStockProducts: Array<{ id: string; name: string; stockQuantity: number; lowStockThreshold: number }>
}

export interface TopProduct {
  productId: string
  name: string
  quantitySold: number
  revenue: number
}

async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const res = await request<DashboardSummary>(`/analytics/dashboard?range=${range}`)
  return res.data
}

async function getTopProducts(range: DashboardRange): Promise<TopProduct[]> {
  const res = await request<TopProduct[]>(`/analytics/top-products?range=${range}`)
  return res.data
}

export function useDashboardSummary(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.summary(range), queryFn: () => getDashboardSummary(range) })
}

export function useTopProducts(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.topProducts(range), queryFn: () => getTopProducts(range) })
}
