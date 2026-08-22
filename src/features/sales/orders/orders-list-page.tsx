import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrders, type FulfillmentStatus, type Order } from '@/lib/api/orders'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<FulfillmentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
const STATUS_VARIANT: Record<FulfillmentStatus, 'secondary' | 'warning' | 'default' | 'success' | 'destructive'> = {
  pending: 'secondary',
  processing: 'warning',
  shipped: 'default',
  delivered: 'success',
  cancelled: 'destructive',
}
const PAYMENT_LABEL: Record<string, string> = { unpaid: 'Unpaid', partially_paid: 'Partially paid', paid: 'Paid', refunded: 'Refunded' }

type OrderRow = Order & { customerName: string; customerEmail: string }

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
    status: status === 'all' ? undefined : (status as FulfillmentStatus),
  })

  const columns: ColumnDef<OrderRow>[] = [
    { accessorKey: 'orderNumber', header: 'Order', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.orderNumber}</span> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.customerName}</span>
        <span className="text-xs text-muted-foreground">{row.original.customerEmail}</span>
      </div>
    ) },
    { id: 'items', header: 'Items', cell: ({ row }) => row.original.items.reduce((sum, i) => sum + i.quantity, 0) },
    { accessorKey: 'total', header: 'Total', cell: ({ row }) => formatCurrency(row.original.total) },
    { id: 'payment', header: 'Payment', cell: ({ row }) => <Badge variant="outline">{PAYMENT_LABEL[row.original.paymentStatus]}</Badge> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.fulfillmentStatus]}>{STATUS_LABEL[row.original.fulfillmentStatus]}</Badge> },
    { accessorKey: 'createdAt', header: 'Placed', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Orders" description="Track and fulfill customer orders." />

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as OrderRow[]}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by order # or customer…"
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
