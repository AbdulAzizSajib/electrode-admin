import * as React from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DollarSign, ShoppingCart, Users, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/features/dashboard/components/stat-card'
import { BarList } from '@/features/dashboard/components/bar-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardSummary, useTopProducts, type DashboardRange } from '@/lib/api/dashboard'
import { formatCurrency, formatDate, formatCompactCurrency, formatCompactNumber } from '@/lib/utils/format'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

export default function DashboardPage() {
  const [range, setRange] = React.useState<DashboardRange>('30d')
  const { data, isLoading } = useDashboardSummary(range)
  const { data: topProducts, isLoading: topProductsLoading } = useTopProducts(range)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" description="An overview of your store's performance." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Total Revenue" value={formatCurrency(data.kpis.totalRevenue)} trend={data.kpis.revenueTrend} icon={DollarSign} />
            <StatCard label="Total Orders" value={String(data.kpis.totalOrders)} trend={data.kpis.ordersTrend} icon={ShoppingCart} />
            <StatCard label="Total Customers" value={String(data.kpis.totalCustomers)} icon={Users} />
            <StatCard label="Low Stock Items" value={String(data.kpis.lowStockCount)} icon={AlertTriangle} />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Revenue & Orders</CardTitle>
          <Tabs value={range} onValueChange={(v) => setRange(v as DashboardRange)}>
            <TabsList>
              <TabsTrigger value="7d">7 days</TabsTrigger>
              <TabsTrigger value="30d">30 days</TabsTrigger>
              <TabsTrigger value="90d">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Revenue</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => formatDate(v).replace(/,.*/, '')} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(v) => formatDate(v as string)}
                      contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: 'var(--color-border)' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Orders</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.ordersSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => formatDate(v).replace(/,.*/, '')} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip labelFormatter={(v) => formatDate(v as string)} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: 'var(--color-border)' }} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-info)" fill="var(--color-info)" fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {isLoading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" description="Recent orders will show up here." />
            ) : (
              data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/sales/orders/${order.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{order.orderNumber}</span>
                    <span className="text-xs text-muted-foreground">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>{order.status}</Badge>
                    <span className="w-16 text-right font-medium">{formatCurrency(order.total)}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {isLoading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : data.lowStockProducts.length === 0 ? (
              <EmptyState title="Stock levels look healthy" description="No products are below their reorder threshold." />
            ) : (
              data.lowStockProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/catalog/products/${product.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{product.name}</span>
                  <Badge variant="warning">{product.stockQuantity} left</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {topProductsLoading || !topProducts ? (
            <Skeleton className="h-48 w-full" />
          ) : topProducts.length === 0 ? (
            <EmptyState title="No sales yet" description="Best-selling products will show up here." />
          ) : (
            <BarList
              items={topProducts.slice(0, 8).map((p) => ({
                key: p.productId,
                label: p.name,
                value: p.quantitySold,
                valueLabel: `${formatCompactNumber(p.quantitySold)} sold`,
                sublabel: formatCurrency(p.revenue),
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
