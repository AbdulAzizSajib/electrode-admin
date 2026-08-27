import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrders, type Order, type OrderStatus } from '@/lib/api/orders'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}
const STATUS_VARIANT: Record<OrderStatus, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

export default function OrdersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useOrders({
    search,
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as OrderStatus),
  })

  const columns: ColumnDef<Order>[] = [
    { accessorKey: 'orderNumber', header: 'Order', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.orderNumber}</span> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.customer.firstName} {row.original.customer.lastName ?? ''}</span>
        <span className="text-xs text-muted-foreground">{row.original.customer.email ?? '—'}</span>
      </div>
    ) },
    // The list endpoint omits `items`; fall back to an em dash rather than a misleading 0.
    { id: 'items', header: 'Items', cell: ({ row }) => row.original.items?.reduce((sum, i) => sum + i.quantity, 0) ?? '—' },
    { id: 'total', header: 'Total', cell: ({ row }) => formatCurrency(Number(row.original.totalAmount)) },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    { accessorKey: 'createdAt', header: 'Placed', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Orders" description="Track and fulfill customer orders." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by order number…"
        onRowClick={(row) => navigate(`/sales/orders/${row.id}`)}
        emptyState={{ icon: ShoppingCart, title: 'No orders found' }}
        toolbar={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />
    </div>
  )
}
