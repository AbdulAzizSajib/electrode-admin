import { useQuery } from '@tanstack/react-query'
import { delay } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { _getAllOrders } from '@/lib/api/orders'
import { _getAllUsers } from '@/lib/api/users'
import { _getAllProducts } from '@/lib/api/products'

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
    customersTrend: number
    lowStockCount: number
    lowStockTrend: number
  }
  revenueSeries: TimeSeriesPoint[]
  ordersSeries: TimeSeriesPoint[]
  recentOrders: Array<{ id: string; orderNumber: string; customerName: string; total: number; status: string; createdAt: string }>
  lowStockProducts: Array<{ id: string; name: string; stockQuantity: number; lowStockThreshold: number }>
}

const RANGE_DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

function buildSeries(days: number, seedBase: number, volatility: number): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000)
    const wave = Math.sin(i / 3) * volatility
    const trendUp = ((days - i) / days) * volatility * 0.6
    const value = Math.max(0, Math.round(seedBase + wave + trendUp))
    points.push({ date: date.toISOString().slice(0, 10), value })
  }
  return points
}

async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const days = RANGE_DAYS[range]
  const orders = _getAllOrders()
  const customers = _getAllUsers().filter((u) => u.role === 'CUSTOMER')
  const products = _getAllProducts()

  const nonCancelled = orders.filter((o) => o.fulfillmentStatus !== 'cancelled')
  const totalRevenue = Math.round(nonCancelled.reduce((sum, o) => sum + o.total, 0) * 100) / 100
  const lowStockProducts = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold)

  const users = _getAllUsers()
  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: users.find((u) => u.id === o.customerId)?.name ?? 'Unknown',
      total: o.total,
      status: o.fulfillmentStatus,
      createdAt: o.createdAt,
    }))

  return delay({
    kpis: {
      totalRevenue,
      revenueTrend: 8.4,
      totalOrders: nonCancelled.length,
      ordersTrend: 4.1,
      totalCustomers: customers.length,
      customersTrend: 12.7,
      lowStockCount: lowStockProducts.length,
      lowStockTrend: lowStockProducts.length > 3 ? 15.2 : -6.3,
    },
    revenueSeries: buildSeries(days, totalRevenue / days, totalRevenue / days / 2),
    ordersSeries: buildSeries(days, nonCancelled.length / days, 2),
    recentOrders,
    lowStockProducts: lowStockProducts
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, stockQuantity: p.stockQuantity, lowStockThreshold: p.lowStockThreshold })),
  })
}

export function useDashboardSummary(range: DashboardRange) {
  return useQuery({ queryKey: queryKeys.dashboard.summary(range), queryFn: () => getDashboardSummary(range) })
}
