import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useCustomer, customerFullName, type CustomerStatus } from '@/lib/api/customers'
import { useOrders } from '@/lib/api/orders'
import { formatCurrency, formatDate, initials } from '@/lib/utils/format'

const ORDER_STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

const CUSTOMER_STATUS_VARIANT: Record<CustomerStatus, 'success' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  BLOCKED: 'destructive',
}

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(customerId)
  // `GET /orders` has no customerId filter, so the recent-orders list below is filtered from a
  // fetched page and is not exhaustive. The order count and spend shown in Stats do NOT come from
  // it — those are aggregated server-side over every non-cancelled order.
  const { data: ordersData } = useOrders({ limit: 100 })
  const customerOrders = ordersData?.data.filter((o) => o.customerId === customerId) ?? []

  useBreadcrumbLabel(customer ? customerFullName(customer) : undefined)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!customer) return <EmptyState title="Customer not found" />

  const fullName = customerFullName(customer)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/customers/customers')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader className="flex-1" title={fullName} description={customer.email ?? customer.phone ?? undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              {customerOrders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No recent orders.</p>
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
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'secondary'}>{order.status}</Badge>
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
                customer.addresses.map((addr) => (
                  <div key={addr.id} className="flex flex-col gap-0.5 rounded-md border border-border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{addr.fullName}</p>
                      {addr.isDefault && <Badge variant="outline">Default</Badge>}
                    </div>
                    <p className="text-muted-foreground">{addr.phone}</p>
                    <p className="text-muted-foreground">{addr.addressLine1}</p>
                    {addr.addressLine2 && <p className="text-muted-foreground">{addr.addressLine2}</p>}
                    <p className="text-muted-foreground">
                      {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
                    </p>
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
                <AvatarImage src={customer.avatar ?? undefined} alt="" />
                <AvatarFallback className="text-base">{initials(fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{fullName}</p>
                <p className="text-xs text-muted-foreground">{customer.email ?? 'No email'}</p>
              </div>
              <Badge variant={CUSTOMER_STATUS_VARIANT[customer.status]}>{customer.status}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{formatDate(customer.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className={customer.phone ? undefined : 'text-muted-foreground'}>{customer.phone ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Orders</span>
                <span>{customer.orderCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total spent</span>
                <span className="font-medium text-foreground">{formatCurrency(customer.totalSpent)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
