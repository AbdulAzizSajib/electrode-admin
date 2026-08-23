import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useCustomer } from '@/lib/api/customers'
import { useOrders } from '@/lib/api/orders'
import { formatCurrency, formatDate, initials } from '@/lib/utils/format'

const STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(customerId)
  // The real GET /orders has no customerId filter (admin-facing list endpoints only support
  // status/searchTerm) — fetch a page and filter client-side. Not exhaustive for a customer with
  // more orders than this page size; good enough until customers.ts's own migration.
  const { data: ordersData } = useOrders({ limit: 100 })
  const customerOrders = ordersData?.data.filter((o) => o.customerId === customerId) ?? []

  useBreadcrumbLabel(customer?.name)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!customer) return <EmptyState title="Customer not found" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/customers/customers')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader className="flex-1" title={customer.name} description={customer.email} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              {customerOrders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                customerOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/sales/orders/${order.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{order.orderNumber}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>{order.status}</Badge>
                      <span className="w-16 text-right font-medium">{formatCurrency(Number(order.totalAmount))}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Addresses</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved addresses.</p>
              ) : (
                customer.addresses.map((addr, i) => (
                  <div key={i} className="rounded-md border border-border p-2.5 text-sm">
                    <p className="font-medium text-foreground">{addr.fullName}</p>
                    <p className="text-muted-foreground">{addr.line1}</p>
                    {addr.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
                    <p className="text-muted-foreground">{addr.city}, {addr.state} {addr.postalCode}</p>
                    <p className="text-muted-foreground">{addr.country}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <Avatar className="size-14">
                <AvatarFallback className="text-base">{initials(customer.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.email}</p>
              </div>
              <Badge variant={customer.isActive ? 'success' : 'secondary'}>{customer.isActive ? 'Active' : 'Inactive'}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Joined</span><span>{formatDate(customer.joinedAt)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Orders</span><span>{customer.orderCount}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Total spent</span><span className="font-medium text-foreground">{formatCurrency(customer.totalSpent)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
