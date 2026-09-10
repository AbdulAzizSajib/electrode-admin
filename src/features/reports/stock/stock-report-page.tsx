import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { useStockReport, reportExports, type StockReportRow } from '@/lib/api/reports'
import { useWarehouses } from '@/lib/api/warehouses'
import { useCategories } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { ReportSummary, type ReportStat } from '@/features/reports/components/report-summary'
import { ExportButton } from '@/features/reports/components/export-button'
import {
  ReportFilterSelect,
  ReportToolbar,
  type AppliedFilter,
} from '@/features/reports/components/report-toolbar'
import { ALL_VALUE } from '@/features/reports/report-utils'

/**
 * A position, not a period — so this page deliberately offers NO date range
 * (`admin-reporting/stock-reports`). It says so in the header rather than
 * leaving a merchant hunting for a picker that is not there.
 */
export default function StockReportPage() {
  const [warehouseId, setWarehouseId] = React.useState(ALL_VALUE)
  const [categoryId, setCategoryId] = React.useState(ALL_VALUE)
  const [brandId, setBrandId] = React.useState(ALL_VALUE)
  const [search, setSearch] = React.useState('')
  const [lowStockOnly, setLowStockOnly] = React.useState(false)
  const [mismatchedOnly, setMismatchedOnly] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const params = {
    page,
    limit: pageSize,
    warehouseId: warehouseId === ALL_VALUE ? undefined : warehouseId,
    categoryId: categoryId === ALL_VALUE ? undefined : categoryId,
    brandId: brandId === ALL_VALUE ? undefined : brandId,
    searchTerm: search || undefined,
    lowStockOnly: lowStockOnly || undefined,
    mismatchedOnly: mismatchedOnly || undefined,
  }

  const { data, isLoading, isError, refetch } = useStockReport(params)
  const { data: warehouses } = useWarehouses()
  const { data: categories } = useCategories()
  const { data: brands } = useBrands()

  const summary = data?.summary
  // The cached-quantity comparison is meaningless per warehouse: the mirror
  // counts every warehouse, so the server suppresses it and so does this page.
  const showsMismatch = warehouseId === ALL_VALUE

  const stats: ReportStat[] = [
    { label: 'Items', value: formatNumber(summary?.itemCount ?? 0) },
    { label: 'Units on hand', value: formatNumber(summary?.totalUnits ?? 0) },
    {
      label: 'Stock value at cost',
      value: formatCurrency(summary?.totalCostValue ?? 0),
      // The disclosure the spec requires: a cost total that silently omits
      // unpriced stock reads as complete when it is not.
      hint:
        summary && summary.unvaluedItemCount > 0
          ? `Excludes ${formatNumber(summary.unvaluedItemCount)} item(s) / ${formatNumber(summary.unvaluedUnitCount)} unit(s) with no purchase price`
          : 'Every item in this result has a purchase price',
    },
    { label: 'Stock value at retail', value: formatCurrency(summary?.totalRetailValue ?? 0) },
  ]

  const toggleRow = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rowKey = (row: StockReportRow) => `${row.productId}::${row.variantId ?? ''}`

  const columns: ColumnDef<StockReportRow>[] = [
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => {
        const key = rowKey(row.original)
        const isOpen = expanded.has(key)
        return (
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => toggleRow(key)}
              aria-label={isOpen ? 'Hide warehouse split' : 'Show warehouse split'}
              className="mt-0.5 text-muted-foreground hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{row.original.itemName}</span>
              <span className="text-xs text-muted-foreground">{row.original.sku ?? 'No SKU'}</span>
              {isOpen && (
                <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {row.original.warehouses.length === 0 ? (
                    <span>Held in no warehouse</span>
                  ) : (
                    row.original.warehouses.map((warehouse) => (
                      <span key={warehouse.warehouseId}>
                        {warehouse.warehouseName}: {formatNumber(warehouse.quantity)}
                        {warehouse.reserved > 0 && ` (${formatNumber(warehouse.reserved)} reserved)`}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    { id: 'onHand', header: 'On hand', cell: ({ row }) => formatNumber(row.original.onHand) },
    { id: 'reserved', header: 'Reserved', cell: ({ row }) => formatNumber(row.original.reserved) },
    {
      id: 'available',
      header: 'Available',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {formatNumber(row.original.available)}
          {row.original.isLowStock && <Badge variant="warning">Low</Badge>}
        </span>
      ),
    },
    {
      id: 'costValue',
      header: 'Cost value',
      cell: ({ row }) =>
        row.original.costValue === null ? (
          // Never "৳0" — an item with no purchase price is unvalued, and showing
          // zero would read as free stock.
          <span className="text-muted-foreground">No purchase price</span>
        ) : (
          formatCurrency(row.original.costValue)
        ),
    },
    {
      id: 'retailValue',
      header: 'Retail value',
      cell: ({ row }) =>
        row.original.retailValue === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatCurrency(row.original.retailValue)
        ),
    },
    ...(showsMismatch
      ? [
          {
            id: 'mismatch',
            header: 'Cached',
            cell: ({ row }: { row: { original: StockReportRow } }) =>
              row.original.hasQuantityMismatch ? (
                <span
                  className="flex items-center gap-1 text-destructive"
                  title={`Cached quantity ${row.original.cachedQuantity} does not match the ${row.original.onHand} held across warehouses`}
                >
                  <TriangleAlert className="size-3.5" />
                  {formatNumber(row.original.cachedQuantity)}
                </span>
              ) : (
                <span className="text-muted-foreground">OK</span>
              ),
          } as ColumnDef<StockReportRow>,
        ]
      : []),
  ]

  const applied: AppliedFilter[] = [
    ...(warehouseId !== ALL_VALUE
      ? [
          {
            label: `Warehouse: ${warehouses?.data.find((w) => w.id === warehouseId)?.name ?? warehouseId}`,
            onClear: () => setWarehouseId(ALL_VALUE),
          },
        ]
      : []),
    ...(categoryId !== ALL_VALUE
      ? [
          {
            label: `Category: ${categories?.data.find((c) => c.id === categoryId)?.name ?? categoryId}`,
            onClear: () => setCategoryId(ALL_VALUE),
          },
        ]
      : []),
    ...(brandId !== ALL_VALUE
      ? [
          {
            label: `Brand: ${brands?.data.find((b) => b.id === brandId)?.name ?? brandId}`,
            onClear: () => setBrandId(ALL_VALUE),
          },
        ]
      : []),
    ...(lowStockOnly ? [{ label: 'Low stock only', onClear: () => setLowStockOnly(false) }] : []),
    ...(mismatchedOnly
      ? [{ label: 'Mismatched cache only', onClear: () => setMismatchedOnly(false) }]
      : []),
  ]

  const clearAll = () => {
    setWarehouseId(ALL_VALUE)
    setCategoryId(ALL_VALUE)
    setBrandId(ALL_VALUE)
    setSearch('')
    setLowStockOnly(false)
    setMismatchedOnly(false)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock report"
        description="What is on the shelf right now, and what it is worth. This is a position as of now, not a period — there is no date range."
      />

      <ReportSummary stats={stats} isLoading={isLoading} />

      <ReportToolbar
        applied={applied}
        onClearAll={clearAll}
        actions={<ExportButton onExport={() => reportExports.stock(params)} />}
      >
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
          label="Category"
          allLabel="All categories"
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value)
            setPage(1)
          }}
          options={(categories?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <ReportFilterSelect
          label="Brand"
          allLabel="All brands"
          value={brandId}
          onChange={(value) => {
            setBrandId(value)
            setPage(1)
          }}
          options={(brands?.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        <Button
          size="lg"
          variant={lowStockOnly ? 'default' : 'outline'}
          onClick={() => {
            setLowStockOnly((current) => !current)
            setPage(1)
          }}
        >
          Low stock {summary ? `(${formatNumber(summary.lowStockCount)})` : ''}
        </Button>
        {showsMismatch && (
          <Button
            size="lg"
            variant={mismatchedOnly ? 'default' : 'outline'}
            onClick={() => {
              setMismatchedOnly((current) => !current)
              setPage(1)
            }}
          >
            Mismatched {summary ? `(${formatNumber(summary.mismatchedItemCount)})` : ''}
          </Button>
        )}
      </ReportToolbar>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage="The stock report could not be produced."
        onRetry={refetch}
        emptyState={{
          icon: Boxes,
          title: 'No items match the current filters',
          description: 'Clear the filters to see the full stock position.',
        }}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Search by item name or SKU…"
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
