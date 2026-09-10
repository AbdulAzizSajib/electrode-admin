import * as React from 'react'
import { DollarSign, ShoppingCart, Users, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/features/dashboard/components/stat-card'
import { BarList } from '@/features/dashboard/components/bar-list'
import { TrendChart } from '@/features/dashboard/components/trend-chart'
import { WatchlistRow } from '@/features/dashboard/components/watchlist-row'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardSummary, useTopProducts, type DashboardRange } from '@/lib/api/dashboard'
import { formatCurrency, formatDate, formatCompactCurrency, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

/**
 * Names the baseline the KPI trends are measured against.
 *
 * The backend computes them against the immediately preceding period of equal length
 * (`add-dashboard-analytics-api`), so the label has to track the selected range — a
 * fixed "vs last month" would be a false statement on the 7d and 90d tabs.
 */
const TREND_LABEL: Record<DashboardRange, string> = {
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '90d': 'vs previous 90 days',
}

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

export default function DashboardPage() {
  const [range, setRange] = React.useState<DashboardRange>('30d')
  const summary = useDashboardSummary(range)
  const products = useTopProducts(range)

  const { data, isPending, isError, isPlaceholderData, refetch } = summary

  /*
   * `isPending`, not `isLoading`: with `keepPreviousData` in play a range switch keeps
   * the previous range's data on screen, and we want to dim it rather than tear it down.
   * Only the very first load — when there is genuinely nothing to show — gets skeletons.
   */
  const showSkeleton = isPending && !data

  /* The whole grid fades together while a switched range is in flight, so the change
     reads as one state settling rather than each card blinking on its own schedule. */
  const stale = cn(isPlaceholderData && 'opacity-60 transition-opacity')

  /*
   * The summary failing is ONE event, reported once.
   *
   * Four of this page's five regions — the KPI tiles, both charts, and the two
   * watchlists — are all views onto the single `/analytics/dashboard` response, so a
   * failed fetch would otherwise render four identical "Couldn't load data / Try again"
   * blocks and offer the merchant four buttons that fire the same request. One banner
   * states the problem once; the regions it feeds simply don't render. Top Products is
   * a separate endpoint and keeps its own inline error, because it genuinely can fail
   * on its own while the rest of the page is fine.
   */
  const summaryFailed = !showSkeleton && (isError || !data)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboard" description="An overview of your store's performance." />

      {/*
        One range control for the whole page, above everything it scopes — it drives the
        KPI tiles, both charts and the top-products list alike. Keeping it inside the
        chart card (where it used to live) implied it only scoped that card.
      */}
      <Tabs value={range} onValueChange={(v) => setRange(v as DashboardRange)}>
        <TabsList aria-label="Reporting period">
          {RANGE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {summaryFailed && (
        <Card>
          <CardContent className="p-4">
            <ErrorState
              description="Your store's figures, trends and watchlists could not be loaded."
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      )}

      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', stale)}>
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : !data ? null : (
          <>
            <StatCard
              label="Total Revenue"
              value={formatCurrency(data.kpis.totalRevenue)}
              trend={data.kpis.revenueTrend}
              trendLabel={TREND_LABEL[range]}
              icon={DollarSign}
            />
            <StatCard
              label="Total Orders"
              value={formatNumber(data.kpis.totalOrders)}
              trend={data.kpis.ordersTrend}
              trendLabel={TREND_LABEL[range]}
              icon={ShoppingCart}
            />
            {/* No trend on these two: the backend has no time-series basis for either,
                and inventing one would be a fabricated comparison. */}
            <StatCard
              label="Total Customers"
              value={formatNumber(data.kpis.totalCustomers)}
              icon={Users}
            />
            <StatCard
              label="Low Stock Items"
              value={formatNumber(data.kpis.lowStockCount)}
              icon={AlertTriangle}
            />
          </>
        )}
      </div>

      {!summaryFailed && (
      <Card className={stale}>
        <CardHeader>
          <CardTitle>Revenue &amp; Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {showSkeleton || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TrendChart
                data={data.revenueSeries}
                label="Revenue"
                color="var(--color-primary)"
                formatTick={formatCompactCurrency}
                formatValue={formatCurrency}
                axisWidth={52}
              />
              <TrendChart
                data={data.ordersSeries}
                label="Orders"
                color="var(--color-info)"
                formatTick={formatNumber}
                formatValue={formatNumber}
                axisWidth={36}
                allowDecimals={false}
              />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {!summaryFailed && (
      <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2', stale)}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {showSkeleton || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" description="Recent orders will show up here." />
            ) : (
              data.recentOrders.map((order) => (
                <WatchlistRow
                  key={order.id}
                  to={`/sales/orders/${order.id}`}
                  title={order.orderNumber}
                  subtitle={`${order.customerName} · ${formatDate(order.createdAt)}`}
                  trailing={
                    <>
                      <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
                        {order.status}
                      </Badge>
                      {/* Right-aligned and tabular so the column of amounts scans
                          vertically; no fixed width, which clipped large totals. */}
                      <span className="text-right font-medium tabular-nums">
                        {formatCurrency(order.total)}
                      </span>
                    </>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5">
            {showSkeleton || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : data.lowStockProducts.length === 0 ? (
              <EmptyState
                title="Stock levels look healthy"
                description="No products are below their reorder threshold."
              />
            ) : (
              data.lowStockProducts.map((product) => (
                <WatchlistRow
                  key={product.id}
                  to={`/catalog/products/${product.id}`}
                  title={product.name}
                  /* The threshold is what makes the count meaningful — "3 left" is only
                     alarming once you know it reorders at 10. */
                  subtitle={`Reorders at ${formatNumber(product.lowStockThreshold)}`}
                  trailing={
                    <Badge variant="warning">
                      {formatNumber(product.stockQuantity)} left
                    </Badge>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <Card className={cn(products.isPlaceholderData && 'opacity-60 transition-opacity')}>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {products.isPending && !products.data ? (
            <Skeleton className="h-48 w-full" />
          ) : products.isError || !products.data ? (
            <ErrorState
              description="Best-selling products could not be loaded."
              onRetry={() => products.refetch()}
            />
          ) : products.data.length === 0 ? (
            <EmptyState title="No sales yet" description="Best-selling products will show up here." />
          ) : (
            <BarList
              measureLabel="units sold"
              items={products.data.slice(0, 8).map((p) => ({
                key: p.productId,
                label: p.name,
                href: `/catalog/products/${p.productId}`,
                value: p.quantitySold,
                /* Exact, not compacted: this list ranks by units sold, so the units are
                   the point — "1.2K sold" throws away the digits being compared. */
                valueLabel: `${formatNumber(p.quantitySold)} sold`,
                sublabel: formatCurrency(p.revenue),
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
