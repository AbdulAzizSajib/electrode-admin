import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useReturns, type ReturnRequest, type ReturnStatus } from '@/lib/api/returns'
import { formatDate } from '@/lib/utils/format'

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<ReturnStatus, 'secondary' | 'warning' | 'destructive' | 'info' | 'success'> = {
  REQUESTED: 'secondary',
  APPROVED: 'warning',
  REJECTED: 'destructive',
  RECEIVED: 'info',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export default function ReturnsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useReturns({ page, limit: pageSize, status: status === 'all' ? undefined : (status as ReturnStatus) })

  const columns: ColumnDef<ReturnRequest>[] = [
    { id: 'order', header: 'Order', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.order.orderNumber}</span> },
    { id: 'items', header: 'Items', cell: ({ row }) => row.original.items.map((i) => `${i.quantity}× ${i.orderItem.productName}`).join(', ') },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-muted-foreground">{row.original.reason}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    { accessorKey: 'createdAt', header: 'Requested', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Returns" description="Customer return requests." />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => navigate(`/sales/returns/${row.id}`)}
        emptyState={{ icon: Undo2, title: 'No return requests' }}
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
