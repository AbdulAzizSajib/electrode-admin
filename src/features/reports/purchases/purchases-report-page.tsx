import * as React from 'react'
import { Link } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Info } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  usePurchaseReport,
  reportExports,
  type PurchaseGroupBy,
  type PurchaseReportRow,
} from '@/lib/api/reports'
import { useSuppliers } from '@/lib/api/suppliers'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format'
import { ReportSummary, type ReportStat } from '@/features/reports/components/report-summary'
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

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const GROUP_OPTIONS: Array<{ value: PurchaseGroupBy; label: string }> = [
  { value: 'supplier', label: 'By supplier' },
  { value: 'status', label: 'By status' },
  { value: 'day', label: 'By day' },
]

const RECEIPT_VARIANT: Record<PurchaseReportRow['receiptState'], 'success' | 'warning' | 'secondary' | 'destructive'> = {
  COMPLETE: 'success',
  PARTIAL: 'warning',
  AWAITING: 'secondary',
  CANCELLED: 'destructive',
}

const SETTLEMENT_VARIANT: Record<PurchaseReportRow['settlementState'], 'success' | 'warning' | 'destructive'> = {
  SETTLED: 'success',
  PARTIALLY_PAID: 'warning',
  UNPAID: 'destructive',
}

export default function PurchasesReportPage() {
  const [range, setRange] = React.useState<DateRangeValue>(defaultDateRange)
  const [supplierId, setSupplierId] = React.useState(ALL_VALUE)
  const [status, setStatus] = React.useState(ALL_VALUE)
  const [groupBy, setGroupBy] = React.useState(ALL_VALUE)
  const [includeDrafts, setIncludeDrafts] = React.useState(false)
  const [owingOnly, setOwingOnly] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const params = {
    ...range,
    page,
    limit: pageSize,
    supplierId: supplierId === ALL_VALUE ? undefined : supplierId,
    status: status === ALL_VALUE ? undefined : status,
    groupBy: groupBy === ALL_VALUE ? undefined : (groupBy as PurchaseGroupBy),
    includeDrafts: includeDrafts || undefined,
    owingOnly: owingOnly || undefined,
  }

  const { data, isLoading, isError, refetch } = usePurchaseReport(params)
  const { data: suppliers } = useSuppliers({ limit: 200 })
  const summary = data?.summary

  const stats: ReportStat[] = [
    {
      label: 'Purchase value',
      value: formatCurrency(summary?.purchaseValue ?? 0),
      hint: `${formatNumber(summary?.purchaseOrderCount ?? 0)} purchase order(s)`,
    },
    { label: 'Paid to suppliers', value: formatCurrency(summary?.amountPaid ?? 0), tone: 'positive' },
    {
      label: 'Still owed',
      value: formatCurrency(summary?.balanceOwed ?? 0),
      tone: summary && summary.balanceOwed > 0 ? 'negative' : 'muted',
    },
    {
      label: 'Units ordered',
      value: formatNumber(summary?.quantityOrdered ?? 0),
      hint: `${formatNumber(summary?.quantityReceived ?? 0)} received`,
    },
  ]

  const columns: ColumnDef<PurchaseReportRow>[] = [
    {
      id: 'purchaseNumber',
      header: 'Purchase',
      cell: ({ row }) => (
        <Link
          to={`/inventory/purchase-orders/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.purchaseNumber}
        </Link>
      ),
    },
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.supplierName}
          {/* Marked, not omitted — a deactivated supplier's past purchases are
              still purchases the merchant made. */}
          {!row.original.supplierIsActive && <Badge variant="outline">Inactive</Badge>}
        </span>
      ),
    },
    {
      id: 'received',
      header: 'Received',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {formatNumber(row.original.quantityReceived)} / {formatNumber(row.original.quantityOrdered)}
          <Badge variant={RECEIPT_VARIANT[row.original.receiptState]}>
            {row.original.receiptState === 'AWAITING'
              ? 'Awaiting'
              : row.original.receiptState === 'PARTIAL'
                ? 'Partial'
                : row.original.receiptState === 'COMPLETE'
                  ? 'Complete'
                  : 'Cancelled'}
          </Badge>
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Value',
      cell: ({ row }) => formatCurrency(row.original.purchaseValue),
    },
    {
      id: 'paid',
      header: 'Paid',
      cell: ({ row }) => (
        <span className="text-success">{formatCurrency(row.original.amountPaid)}</span>
      ),
    },
    {
      id: 'owed',
      header: 'Owed',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.balanceOwed > 0 ? (
            <span className="text-destructive">{formatCurrency(row.original.balanceOwed)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <Badge variant={SETTLEMENT_VARIANT[row.original.settlementState]}>
            {row.original.settlementState === 'SETTLED'
              ? 'Settled'
              : row.original.settlementState === 'PARTIALLY_PAID'
                ? 'Part paid'
                : 'Unpaid'}
          </Badge>
        </span>
      ),
    },
  ]

  const applied: AppliedFilter[] = [
    ...(supplierId !== ALL_VALUE
      ? [
          {
            label: `Supplier: ${suppliers?.data.find((s) => s.id === supplierId)?.name ?? supplierId}`,
            onClear: () => setSupplierId(ALL_VALUE),
          },
        ]
      : []),
    ...(status !== ALL_VALUE
      ? [
          {
            label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
            onClear: () => setStatus(ALL_VALUE),
          },
        ]
      : []),
    ...(includeDrafts ? [{ label: 'Drafts included', onClear: () => setIncludeDrafts(false) }] : []),
    ...(owingOnly ? [{ label: 'With a balance owing', onClear: () => setOwingOnly(false) }] : []),
  ]

  const clearAll = () => {
    setRange(defaultDateRange())
    setSupplierId(ALL_VALUE)
    setStatus(ALL_VALUE)
    setGroupBy(ALL_VALUE)
    setIncludeDrafts(false)
    setOwingOnly(false)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchases report"
        description="What was bought over a period, what arrived, and what is still owed to each supplier."
      />

      <ReportSummary stats={stats} isLoading={isLoading} />

      {/* The disclosure the spec requires: totals that quietly omit drafts read
          as covering everything listed. */}
      {summary && (summary.excludedDraftCount > 0 || summary.cancelledCount > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {summary.excludedDraftCount > 0 && (
              <>
                {formatNumber(summary.excludedDraftCount)} draft purchase order(s) are left out of
                the money figures — a draft is not yet a commitment. Turn on “Include drafts” to
                count them.{' '}
              </>
            )}
            {summary.cancelledCount > 0 && (
              <>
                {formatNumber(summary.cancelledCount)} cancelled purchase order(s) are listed but
                contribute nothing to the totals.
              </>
            )}
          </span>
        </div>
      )}

      <ReportToolbar
        applied={applied}
        onClearAll={clearAll}
        actions={<ExportButton onExport={() => reportExports.purchases(params)} />}
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
          label="Supplier"
          allLabel="All suppliers"
          className="w-52"
          value={supplierId}
          onChange={(value) => {
            setSupplierId(value)
            setPage(1)
          }}
          options={(suppliers?.data ?? []).map((s) => ({
            value: s.id,
            label: s.companyName || s.name,
          }))}
        />
        <ReportFilterSelect
          label="Status"
          allLabel="All statuses"
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={STATUS_OPTIONS}
        />
        <ReportFilterSelect
          label="Group by"
          allLabel="No grouping"
          value={groupBy}
          onChange={setGroupBy}
          options={GROUP_OPTIONS}
        />
        <Button
          size="sm"
          variant={owingOnly ? 'default' : 'outline'}
          onClick={() => {
            setOwingOnly((current) => !current)
            setPage(1)
          }}
        >
          Owing only
        </Button>
        <Button
          size="sm"
          variant={includeDrafts ? 'default' : 'outline'}
          onClick={() => {
            setIncludeDrafts((current) => !current)
            setPage(1)
          }}
        >
          Include drafts
        </Button>
      </ReportToolbar>

      {data?.groups && data.groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {GROUP_OPTIONS.find((o) => o.value === data.groupBy)?.label ?? 'Grouped'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Purchase orders</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Owed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.groups.map((group) => (
                  <TableRow key={group.key}>
                    <TableCell className="font-medium">{group.label}</TableCell>
                    <TableCell>{formatNumber(group.purchaseOrderCount)}</TableCell>
                    <TableCell>{formatCurrency(group.purchaseValue)}</TableCell>
                    <TableCell>{formatCurrency(group.amountPaid)}</TableCell>
                    <TableCell
                      className={group.balanceOwed > 0 ? 'text-destructive' : 'text-muted-foreground'}
                    >
                      {formatCurrency(group.balanceOwed)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage="The purchases report could not be produced."
        onRetry={refetch}
        emptyState={{
          icon: ClipboardList,
          title: 'No purchase orders match the current filters',
          description: 'Widen the date range or clear the filters.',
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
