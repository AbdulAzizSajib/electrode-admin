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
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}
const STATUS_VARIANT: Record<OrderStatus, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PACKED: 'info',
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

  /*
   * Scan-to-open.
   *
   * A keyboard-wedge barcode scanner types the order number into the search
   * box, so a scan arrives here as an ordinary search. When it resolves to
   * exactly ONE order, open it; the operator scanned a specific parcel and
   * wants that parcel's order.
   *
   * "Exactly one" is the whole guard. `searchTerm` is a SUBSTRING match on the
   * backend, so a scanned number is not guaranteed unique as a query even
   * though `orderNumber` is unique as a column — navigating to the first of
   * several results would silently open the wrong order. Zero or many falls
   * through to the list, where the operator can see what was actually found.
   * See design.md Decision 5.
   *
   * `navigatedFor` keeps this to one navigation per search term: without it,
   * returning to the list with the search still populated would immediately
   * bounce back to the order the operator just navigated away from.
   */
  const navigatedFor = React.useRef<string | null>(null)

  /*
   * Put the cursor in the search box on arrival, so a scan works without
   * clicking first. That is the ergonomic point of scan-to-open: an operator
   * holding a parcel in one hand and a scanner in the other should not need the
   * mouse.
   *
   * Focused by querying this page's own container rather than by adding an
   * `autoFocus` prop to DataTable, which ~117 pages share — most of them want
   * the cursor left alone.
   */
  const pageRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    pageRef.current?.querySelector('input')?.focus()
  }, [])

  React.useEffect(() => {
    if (!search) {
      navigatedFor.current = null
      return
    }
    if (isLoading || isError) return
    if (navigatedFor.current === search) return

    const rows = data?.data ?? []
    if (rows.length !== 1) return

    // Only when the scan names the order outright. A partial term that happens
    // to match one row today is not a scan, and auto-opening it would hijack
    // ordinary typing the moment the result set narrowed to one.
    if (rows[0].orderNumber.toUpperCase() !== search.trim().toUpperCase()) return

    navigatedFor.current = search
    navigate(`/sales/orders/${rows[0].id}`)
  }, [search, data, isLoading, isError, navigate])

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
    <div className="flex flex-col gap-4" ref={pageRef}>
      <PageHeader title="Orders" description="Track and fulfill customer orders." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search or scan an order number…"
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
