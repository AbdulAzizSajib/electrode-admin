import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ShoppingCart, Truck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CourierStatusBadge } from '@/features/sales/courier/courier-status-badge'
import { courierNeedsAttention } from '@/features/sales/courier/courier-presentation'
import { DispatchDialog } from '@/features/sales/courier/dispatch-preview'
import { useConfiguredCourier } from '@/lib/api/courier'
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

  const [selection, setSelection] = React.useState<string[]>([])
  const [dispatchOpen, setDispatchOpen] = React.useState(false)

  /*
   * The courier this shop dispatches through. The bulk action names it and is
   * hidden entirely where the configured courier creates no consignments —
   * offering "send to a courier that cannot receive" is a button that exists
   * only to be refused.
   */
  const courier = useConfiguredCourier()
  const courierName = courier?.displayName ?? 'the courier'
  const canDispatch = courier?.capabilities.dispatch ?? true

  const { data, isLoading, isError, refetch } = useOrders({
    search,
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as OrderStatus),
  })

  /*
   * Selection is cleared whenever the visible set changes.
   *
   * Rows the operator can no longer see must not stay selected: keeping them
   * would mean "12 selected" while four rows are visible, and a dispatch that
   * includes parcels nobody has looked at since narrowing the filter. That is
   * defensible for a delete-many flow over interchangeable objects; it is not
   * when every row is a parcel with a COD amount on it.
   * See design.md Decision 2.
   *
   * Done in the handlers rather than an effect on [page, search, status]: an
   * effect would clear on the render AFTER the change, so a dispatch fired in
   * that window would carry the stale selection — and it is the one case where
   * being a render late sends real parcels.
   */
  const changeView = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setSelection([])
  }

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
    /*
     * Courier state, read off the list payload the server already sends
     * (ORDER_LIST_INCLUDE carries the newest shipment's three courier fields).
     * No per-row request — that would reintroduce the N+1 integrate-orders-api
     * removed. See design.md Decision 5.
     */
    {
      id: 'courier',
      header: 'Courier',
      cell: ({ row }) => {
        const shipment = row.original.shipments?.[0]

        if (!shipment?.consignmentId) {
          return <span className="text-muted-foreground">Not sent</span>
        }

        return (
          <div className="flex items-center gap-1.5">
            <CourierStatusBadge status={shipment.courierStatus} />
            {/*
             * A cancelled or partly-delivered consignment needs a person. The
             * flag says so and nothing more — no status change, no restock;
             * the parcel is still in transit back.
             */}
            {courierNeedsAttention(shipment.courierStatus) ? (
              <span title="Needs attention — resolve through the order's own cancellation or return flow">
                <AlertTriangle className="size-3.5 text-warning" />
              </span>
            ) : null}
          </div>
        )
      },
    },
    { accessorKey: 'createdAt', header: 'Placed', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4" ref={pageRef}>
      <PageHeader title="Orders" description="Track and fulfill customer orders." />

      {/*
       * The bulk action bar, present only when something is selected. It says
       * how many rather than just offering the action, because the count is the
       * one thing an operator checks before sending real parcels.
       */}
      {selection.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {selection.length} order{selection.length === 1 ? '' : 's'} selected
          </span>
          {canDispatch && (
            <Button size="lg" onClick={() => setDispatchOpen(true)}>
              <Truck /> Send to {courierName}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={() => setSelection([])}>
            Clear
          </Button>
        </div>
      )}

      <DispatchDialog
        orderIds={selection}
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        onDispatched={() => setSelection([])}
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        selection={selection}
        onSelectionChange={setSelection}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={changeView((v: string) => { setSearch(v); setPage(1) })}
        searchPlaceholder="Search or scan an order number…"
        onRowClick={(row) => navigate(`/sales/orders/${row.id}`)}
        emptyState={{ icon: ShoppingCart, title: 'No orders found' }}
        toolbar={
          <Select value={status} onValueChange={changeView((v: string) => { setStatus(v); setPage(1) })}>
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
        onPageChange={changeView(setPage)}
        onPageSizeChange={changeView((size: number) => { setPageSize(size); setPage(1) })}
      />
    </div>
  )
}
