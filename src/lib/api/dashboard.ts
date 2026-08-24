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
 * The five reporting hooks below (`useTopProducts`, `useSalesByCategory`,
 * `useOrderStatusBreakdown`, `usePaymentBreakdown`, `useReturnsRefunds`) are backed by
 * `server/openspec/changes/add-analytics-reports-api` — same `range` param, same envelope, same
 * `api/analytics` capability, just five more `GET /analytics/*` routes alongside `/dashboard`.
 */
import { useQuery } from '@tanstack/react-query'
import { ApiError, BASE_URL } from '@/lib/api/client'
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

export interface CategorySales {
  categoryId: string
  categoryName: string
  revenue: number
  orderItemCount: number
}

export interface OrderStatusBreakdownEntry {
  status: string
  count: number
}

export interface PaymentBreakdown {
  byMethod: Array<{ method: string; count: number; amount: number }>
  byStatus: Array<{ status: string; count: number }>
}

export interface ReturnsRefundsSummary {
  returnsByStatus: Array<{ status: string; count: number }>
  refundsByStatus: Array<{ status: string; count: number; amount: number }>
  refundRate: number
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message ?? `Request to ${path} failed`, res.status)
  }
  return json
}

async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const res = await request<DashboardSummary>(`/analytics/dashboard?range=${range}`)
  return res.data
}

async function getTopProducts(range: DashboardRange): Promise<TopProduct[]> {
  const res = await request<TopProduct[]>(`/analytics/top-products?range=${range}`)
  return res.data
}

async function getSalesByCategory(range: DashboardRange): Promise<CategorySales[]> {
  const res = await request<CategorySales[]>(`/analytics/sales-by-category?range=${range}`)
  return res.data
}

async function getOrderStatusBreakdown(range: DashboardRange): Promise<OrderStatusBreakdownEntry[]> {
  const res = await request<OrderStatusBreakdownEntry[]>(`/analytics/order-status-breakdown?range=${range}`)
  return res.data
}

async function getPaymentBreakdown(range: DashboardRange): Promise<PaymentBreakdown> {
  const res = await request<PaymentBreakdown>(`/analytics/payment-breakdown?range=${range}`)
  return res.data
}

async function getReturnsRefunds(range: DashboardRange): Promise<ReturnsRefundsSummary> {
  const res = await request<ReturnsRefundsSummary>(`/analytics/returns-refunds?range=${range}`)
  return res.data
}

export function useDashboardSummary(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.summary(range), queryFn: () => getDashboardSummary(range) })
}

export function useTopProducts(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.topProducts(range), queryFn: () => getTopProducts(range) })
}

export function useSalesByCategory(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.salesByCategory(range), queryFn: () => getSalesByCategory(range) })
}

export function useOrderStatusBreakdown(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.orderStatusBreakdown(range), queryFn: () => getOrderStatusBreakdown(range) })
}

export function usePaymentBreakdown(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.paymentBreakdown(range), queryFn: () => getPaymentBreakdown(range) })
}

export function useReturnsRefunds(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.returnsRefunds(range), queryFn: () => getReturnsRefunds(range) })
}
