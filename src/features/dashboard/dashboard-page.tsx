import * as React from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DollarSign, ShoppingCart, Users, AlertTriangle, PackageX } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/features/dashboard/components/stat-card'
import { BarList } from '@/features/dashboard/components/bar-list'
import { StatusBarList } from '@/features/dashboard/components/status-bar-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDashboardSummary,
  useTopProducts,
  useSalesByCategory,
  useOrderStatusBreakdown,
  usePaymentBreakdown,
  useReturnsRefunds,
  type DashboardRange,
} from '@/lib/api/dashboard'
import { formatCurrency, formatDate, formatCompactCurrency, formatCompactNumber, formatPercent } from '@/lib/utils/format'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Cash on delivery',
  CARD: 'Card',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  STRIPE: 'Stripe',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
}
const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  PAID: 'success',
  FAILED: 'destructive',
  CANCELLED: 'destructive',
  REFUNDED: 'info',
  PARTIALLY_REFUNDED: 'info',
}
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
}

const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
const RETURN_STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'destructive' | 'info' | 'success'> = {
  REQUESTED: 'secondary',
  APPROVED: 'warning',
  REJECTED: 'destructive',
  RECEIVED: 'info',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}
const REFUND_STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'destructive',
}

export default function DashboardPage() {
  const [range, setRange] = React.useState<DashboardRange>('30d')
  const { data, isLoading } = useDashboardSummary(range)

  const { data: topProducts, isLoading: topProductsLoading } = useTopProducts(range)
  const { data: categorySales, isLoading: categorySalesLoading } = useSalesByCategory(range)
  const { data: orderStatusBreakdown, isLoading: orderStatusLoading } = useOrderStatusBreakdown(range)
  const { data: paymentBreakdown, isLoading: paymentBreakdownLoading } = usePaymentBreakdown(range)
  const { data: returnsRefunds, isLoading: returnsRefundsLoading } = useReturnsRefunds(range)

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categorySalesLoading || !categorySales ? (
              <Skeleton className="h-48 w-full" />
            ) : categorySales.length === 0 ? (
              <EmptyState title="No sales yet" description="Revenue by category will show up here." />
            ) : (
              <BarList
                items={categorySales.slice(0, 8).map((c) => ({
                  key: c.categoryId,
                  label: c.categoryName,
                  value: c.revenue,
                  valueLabel: formatCurrency(c.revenue),
                  sublabel: `${c.orderItemCount} item${c.orderItemCount === 1 ? '' : 's'} sold`,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            {orderStatusLoading || !orderStatusBreakdown ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <StatusBarList
                items={orderStatusBreakdown.map((s) => ({
                  key: s.status,
                  label: ORDER_STATUS_LABEL[s.status] ?? s.status,
                  variant: STATUS_VARIANT[s.status] ?? 'secondary',
                  count: s.count,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {paymentBreakdownLoading || !paymentBreakdown ? (
              <Skeleton className="h-48 w-full" />
            ) : paymentBreakdown.byMethod.length === 0 ? (
              <EmptyState title="No payments yet" description="Payment method activity will show up here." />
            ) : (
              <StatusBarList
                items={paymentBreakdown.byMethod.map((m) => ({
                  key: m.method,
                  label: PAYMENT_METHOD_LABEL[m.method] ?? m.method,
                  variant: 'secondary',
                  count: m.count,
                  amountLabel: formatCurrency(m.amount),
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {paymentBreakdownLoading || !paymentBreakdown ? (
              <Skeleton className="h-48 w-full" />
            ) : paymentBreakdown.byStatus.length === 0 ? (
              <EmptyState title="No payments yet" description="Payment status activity will show up here." />
            ) : (
              <StatusBarList
                items={paymentBreakdown.byStatus.map((s) => ({
                  key: s.status,
                  label: PAYMENT_STATUS_LABEL[s.status] ?? s.status,
                  variant: PAYMENT_STATUS_VARIANT[s.status] ?? 'secondary',
                  count: s.count,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between gap-3 py-3.5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Refund Rate</span>
              <span className="text-xl font-semibold text-foreground">
                {returnsRefundsLoading || !returnsRefunds ? '—' : formatPercent(returnsRefunds.refundRate)}
              </span>
              <span className="text-xs text-muted-foreground">Orders with at least one refund</span>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <PackageX className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent>
            {returnsRefundsLoading || !returnsRefunds ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <StatusBarList
                items={returnsRefunds.returnsByStatus.map((s) => ({
                  key: s.status,
                  label: RETURN_STATUS_LABEL[s.status] ?? s.status,
                  variant: RETURN_STATUS_VARIANT[s.status] ?? 'secondary',
                  count: s.count,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            {returnsRefundsLoading || !returnsRefunds ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <StatusBarList
                items={returnsRefunds.refundsByStatus.map((s) => ({
                  key: s.status,
                  label: REFUND_STATUS_LABEL[s.status] ?? s.status,
                  variant: REFUND_STATUS_VARIANT[s.status] ?? 'secondary',
                  count: s.count,
                  amountLabel: formatCurrency(s.amount),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
