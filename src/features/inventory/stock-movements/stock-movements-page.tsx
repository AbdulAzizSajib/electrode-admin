import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { History } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStockMovements, type StockMovement, type StockMovementType } from '@/lib/api/stock-movements'
import { useWarehouses } from '@/lib/api/warehouses'
import { formatDateTime } from '@/lib/utils/format'
// Moved out of this file when Report → Stock history became a second reader of
// StockMovement. Two private copies would drift, and a merchant seeing
// "Transfer in" here and "TRANSFER_IN" there has no way to know they match.
import {
  STOCK_MOVEMENT_TYPE_LABEL as TYPE_LABEL,
  STOCK_MOVEMENT_TYPE_VARIANT as TYPE_VARIANT,
} from '@/lib/utils/stock-movement-labels'

export default function StockMovementsPage() {
  const [warehouseId, setWarehouseId] = React.useState('all')
  const [type, setType] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useStockMovements({
    page,
    limit: pageSize,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    type: type === 'all' ? undefined : (type as StockMovementType),
  })
  const { data: warehousesData } = useWarehouses()

  const columns: ColumnDef<StockMovement>[] = [
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { id: 'product', header: 'Product', cell: ({ row }) => row.original.product.name },
    { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => row.original.warehouse?.name ?? '—' },
    { id: 'type', header: 'Type', cell: ({ row }) => <Badge variant={TYPE_VARIANT[row.original.type]}>{TYPE_LABEL[row.original.type]}</Badge> },
    {
      id: 'quantity',
      header: 'Change',
      cell: ({ row }) => (
        <span className={row.original.quantity >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
          {row.original.quantity >= 0 ? '+' : ''}
          {row.original.quantity}
        </span>
      ),
    },
    { accessorKey: 'note', header: 'Note', cell: ({ row }) => <span className="text-muted-foreground">{row.original.note ?? '—'}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stock Movements" description="A full audit trail of inventory changes." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: History, title: 'No stock movements yet' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehousesData?.data.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
