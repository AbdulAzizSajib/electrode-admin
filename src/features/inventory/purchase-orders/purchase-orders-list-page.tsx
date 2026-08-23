import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePurchaseOrders, type PurchaseOrder, type PurchaseOrderStatus } from '@/lib/api/purchase-orders'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<PurchaseOrderStatus, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  ORDERED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
}

export default function PurchaseOrdersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = usePurchaseOrders({
    search,
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as PurchaseOrderStatus),
  })

  const columns: ColumnDef<PurchaseOrder>[] = [
    { accessorKey: 'purchaseNumber', header: 'PO Number', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.purchaseNumber}</span> },
    { id: 'supplier', header: 'Supplier', cell: ({ row }) => row.original.supplier.name },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    { id: 'total', header: 'Total', cell: ({ row }) => formatCurrency(Number(row.original.totalAmount)) },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        description="Replenish inventory from your suppliers."
        actions={
          <Button size="sm" onClick={() => navigate('/inventory/purchase-orders/new')}>
            <Plus /> New purchase order
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by PO number…"
        onRowClick={(row) => navigate(`/inventory/purchase-orders/${row.id}`)}
        emptyState={{ icon: ClipboardList, title: 'No purchase orders yet' }}
        toolbar={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-44">
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
