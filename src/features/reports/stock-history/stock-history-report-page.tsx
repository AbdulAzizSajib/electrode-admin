import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { History, Info } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { useStockHistoryReport, reportExports, type StockHistoryRow } from '@/lib/api/reports'
import { useWarehouses } from '@/lib/api/warehouses'
import { useProducts } from '@/lib/api/products'
import { formatDateTime, formatNumber } from '@/lib/utils/format'
import {
  STOCK_MOVEMENT_TYPES,
  stockMovementLabel,
  stockMovementVariant,
} from '@/lib/utils/stock-movement-labels'
import { ExportButton } from '@/features/reports/components/export-button'
import { ReportDateRange } from '@/features/reports/components/report-date-range'
import {
  ReportFilterSelect,
  ReportToolbar,
  type AppliedFilter,
} from '@/features/reports/components/report-toolbar'
import {
  ALL_VALUE,
  defaultDateRange,
  resolvedRangeNote,
  type DateRangeValue,
} from '@/features/reports/report-utils'

/**
 * The question Inventory → Stock Movements cannot answer: how a stock position
 * got from where it was to where it is, over a period.
 *
 * That page stays exactly as it is — an unbounded reverse-chronological audit
 * feed. This one adds a date range, the opening → in → out → closing
 * reconciliation, a running balance per row, and export.
 */
export default function StockHistoryReportPage() {
  const [range, setRange] = React.useState<DateRangeValue>(defaultDateRange)
  const [productId, setProductId] = React.useState(ALL_VALUE)
  const [warehouseId, setWarehouseId] = React.useState(ALL_VALUE)
  const [type, setType] = React.useState(ALL_VALUE)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const params = {
    ...range,
    page,
    limit: pageSize,
    productId: productId === ALL_VALUE ? undefined : productId,
    warehouseId: warehouseId === ALL_VALUE ? undefined : warehouseId,
    type: type === ALL_VALUE ? undefined : type,
  }

  const { data, isLoading, isError, refetch } = useStockHistoryReport(params)
  const { data: warehouses } = useWarehouses()
  const { data: products } = useProducts({ limit: 200 })

  const summary = data?.summary

  const columns: ColumnDef<StockHistoryRow>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-foreground">{row.original.productName}</span>
          {row.original.variantName && (
            <span className="text-xs text-muted-foreground">{row.original.variantName}</span>
          )}
        </div>
      ),
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ row }) => row.original.warehouseName ?? '—',
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={stockMovementVariant(row.original.type)}>
          {stockMovementLabel(row.original.type)}
        </Badge>
      ),
    },
    {
      id: 'quantity',
      header: 'Change',
      cell: ({ row }) => (
        // Direction is shown, not inferred: a bare number gives no clue
        // whether stock arrived or left.
        <span
          className={
            row.original.quantity >= 0 ? 'font-medium text-success' : 'font-medium text-destructive'
          }
        >
          {row.original.quantity >= 0 ? '+' : ''}
          {formatNumber(row.original.quantity)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Balance',
      cell: ({ row }) => <span className="font-medium">{formatNumber(row.original.balance)}</span>,
    },
    {
      id: 'note',
      header: 'Note',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.note ?? '—'}</span>,
    },
  ]

  const applied: AppliedFilter[] = [
    ...(productId !== ALL_VALUE
      ? [
          {
            label: `Product: ${products?.data.find((p) => p.id === productId)?.name ?? productId}`,
            onClear: () => setProductId(ALL_VALUE),
          },
        ]
      : []),
    ...(warehouseId !== ALL_VALUE
      ? [
          {
            label: `Warehouse: ${warehouses?.data.find((w) => w.id === warehouseId)?.name ?? warehouseId}`,
            onClear: () => setWarehouseId(ALL_VALUE),
          },
        ]
      : []),
    ...(type !== ALL_VALUE
      ? [{ label: `Type: ${stockMovementLabel(type)}`, onClear: () => setType(ALL_VALUE) }]
      : []),
  ]

  const clearAll = () => {
    setRange(defaultDateRange())
    setProductId(ALL_VALUE)
    setWarehouseId(ALL_VALUE)
    setType(ALL_VALUE)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock history"
        description="How stock moved over a period, with the opening balance it started from and the closing balance it ended at."
      />

      {/* The reconciliation, stated as an equation rather than four loose
          numbers — it is the whole point of the page. */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <Figure label="Opening" value={summary?.opening ?? 0} />
        <Operator>+</Operator>
        <Figure label="In" value={summary?.quantityIn ?? 0} tone="positive" />
        <Operator>−</Operator>
        <Figure label="Out" value={summary?.quantityOut ?? 0} tone="negative" />
        <Operator>=</Operator>
        <Figure label="Closing" value={summary?.closing ?? 0} strong />
        <span className="ml-auto text-xs text-muted-foreground">
          {formatNumber(summary?.movementCount ?? 0)} movement(s) in this period
        </span>
      </Card>

      {summary?.isTypeFiltered && (
        <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info-bg px-3 py-2 text-xs text-info">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            A movement type filter is applied. Only the listed movements are narrowed — opening and
            closing still describe the unfiltered position, so they will not reconcile with the rows
            below.
          </span>
        </div>
      )}

      <ReportToolbar
        applied={applied}
        onClearAll={clearAll}
        actions={<ExportButton onExport={() => reportExports.stockHistory(params)} />}
      >
        <ReportDateRange
          value={range}
          onChange={(next) => {
            setRange(next)
            setPage(1)
          }}
          resolvedNote={resolvedRangeNote(data?.range ?? null)}
        />
        <ReportFilterSelect
          label="Product"
          allLabel="All products"
          className="w-56"
          value={productId}
          onChange={(value) => {
            setProductId(value)
            setPage(1)
          }}
          options={(products?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <ReportFilterSelect
          label="Warehouse"
          allLabel="All warehouses"
          value={warehouseId}
          onChange={(value) => {
            setWarehouseId(value)
            setPage(1)
          }}
          options={(warehouses?.data ?? []).map((w) => ({ value: w.id, label: w.name }))}
        />
        <ReportFilterSelect
          label="Type"
          allLabel="All types"
          value={type}
          onChange={(value) => {
            setType(value)
            setPage(1)
          }}
          options={STOCK_MOVEMENT_TYPES.map((value) => ({
            value,
            label: stockMovementLabel(value),
          }))}
        />
      </ReportToolbar>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage="The stock history could not be produced."
        onRetry={refetch}
        emptyState={{
          icon: History,
          title: 'No movements in this period',
          description:
            'Stock did not move under the current filters. The opening and closing balances above still apply.',
        }}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </div>
  )
}

function Figure({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: number
  tone?: 'positive' | 'negative'
  strong?: boolean
}) {
  const toneClass =
    tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-destructive' : 'text-foreground'
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`${strong ? 'text-2xl' : 'text-xl'} font-semibold ${toneClass}`}>
        {formatNumber(value)}
      </span>
    </div>
  )
}

function Operator({ children }: { children: React.ReactNode }) {
  return <span className="pt-4 text-lg text-muted-foreground">{children}</span>
}
