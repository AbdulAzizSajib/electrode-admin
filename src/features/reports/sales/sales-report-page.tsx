import * as React from 'react'
import { Link } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Info, ReceiptText } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useSalesReport,
  reportExports,
  type SalesGroupBy,
  type SalesOrderRow,
} from '@/lib/api/reports'
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

/**
 * CANCELLED is absent by design — cancelled orders are excluded from this
 * report entirely, so offering the status would promise a filter that can only
 * return nothing (`admin-reporting/sales-reports`).
 */
const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
]

const METHOD_OPTIONS = [
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'CARD', label: 'Card' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
]

const GROUP_OPTIONS: Array<{ value: SalesGroupBy; label: string }> = [
  { value: 'day', label: 'By day' },
  { value: 'product', label: 'By product' },
  { value: 'category', label: 'By category' },
  { value: 'method', label: 'By payment method' },
]

export default function SalesReportPage() {
  const [range, setRange] = React.useState<DateRangeValue>(defaultDateRange)
  const [status, setStatus] = React.useState(ALL_VALUE)
  const [method, setMethod] = React.useState(ALL_VALUE)
  const [groupBy, setGroupBy] = React.useState(ALL_VALUE)
  const [guestOnly, setGuestOnly] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const params = {
    ...range,
    page,
    limit: pageSize,
    status: status === ALL_VALUE ? undefined : status,
    method: method === ALL_VALUE ? undefined : method,
    groupBy: groupBy === ALL_VALUE ? undefined : (groupBy as SalesGroupBy),
    guestOnly: guestOnly || undefined,
  }

  const { data, isLoading, isError, refetch } = useSalesReport(params)
  const summary = data?.summary

  const stats: ReportStat[] = [
    {
      label: 'Order total',
      value: formatCurrency(summary?.orderTotal ?? 0),
      hint: `${formatNumber(summary?.orderCount ?? 0)} order(s)`,
    },
    {
      label: 'Collected',
      value: formatCurrency(summary?.collected ?? 0),
      tone: 'positive',
      hint: 'Settled payments only',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(summary?.outstanding ?? 0),
      tone: summary && summary.outstanding > 0 ? 'negative' : 'muted',
      hint: 'Booked but not yet collected',
    },
    {
      label: 'Refunded',
      value: formatCurrency(summary?.refunded ?? 0),
      hint: `Net of refunds: ${formatCurrency(summary?.net ?? 0)}`,
    },
  ]

  const columns: ColumnDef<SalesOrderRow>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: ({ row }) => (
        <Link
          to={`/sales/orders/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.orderNumber}
        </Link>
      ),
    },
    { id: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.customerName}
          {row.original.isGuestOrder && <Badge variant="outline">Guest</Badge>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
    },
    { id: 'gross', header: 'Gross', cell: ({ row }) => formatCurrency(row.original.grossSales) },
    {
      id: 'discount',
      header: 'Discount',
      cell: ({ row }) =>
        row.original.discount > 0 ? `-${formatCurrency(row.original.discount)}` : '—',
    },
    { id: 'total', header: 'Total', cell: ({ row }) => formatCurrency(row.original.orderTotal) },
    {
      id: 'collected',
      header: 'Collected',
      cell: ({ row }) => (
        <span className="text-success">{formatCurrency(row.original.collected)}</span>
      ),
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      cell: ({ row }) =>
        row.original.outstanding > 0 ? (
          <span className="text-destructive">{formatCurrency(row.original.outstanding)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  const applied: AppliedFilter[] = [
    ...(status !== ALL_VALUE
      ? [
          {
            label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
            onClear: () => setStatus(ALL_VALUE),
          },
        ]
      : []),
    ...(method !== ALL_VALUE
      ? [
          {
            label: `Method: ${METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method}`,
            onClear: () => setMethod(ALL_VALUE),
          },
        ]
      : []),
    ...(guestOnly ? [{ label: 'Guest orders only', onClear: () => setGuestOnly(false) }] : []),
  ]

  const clearAll = () => {
    setRange(defaultDateRange())
    setStatus(ALL_VALUE)
    setMethod(ALL_VALUE)
    setGroupBy(ALL_VALUE)
    setGuestOnly(false)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales report"
        description="What was sold over a period, what was collected, and what is still owed."
      />

      {/* Stated on the page, so the headline figure cannot be misread as cash
          in hand (`admin-reporting/sales-reports`). */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Revenue counts every non-cancelled order by the date it was <strong>placed</strong> —
          including orders not yet paid for. Money actually received is the separate{' '}
          <strong>Collected</strong> figure. Refunds are reported alongside and never reduce the
          order total.
        </span>
      </div>

      <ReportSummary stats={stats} isLoading={isLoading} />

      <ReportToolbar
        applied={applied}
        onClearAll={clearAll}
        actions={<ExportButton onExport={() => reportExports.sales(params)} />}
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
          label="Payment method"
          allLabel="All methods"
          value={method}
          onChange={(value) => {
            setMethod(value)
            setPage(1)
          }}
          options={METHOD_OPTIONS}
        />
        <ReportFilterSelect
          label="Group by"
          allLabel="No grouping"
          value={groupBy}
          onChange={setGroupBy}
          options={GROUP_OPTIONS}
        />
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
                  <TableHead>Orders</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.groups.map((group) => (
                  <TableRow key={group.key}>
                    <TableCell className="font-medium">{group.label}</TableCell>
                    <TableCell>{formatNumber(group.orderCount)}</TableCell>
                    <TableCell>
                      {group.quantity === null ? '—' : formatNumber(group.quantity)}
                    </TableCell>
                    <TableCell>{formatCurrency(group.orderTotal)}</TableCell>
                    <TableCell>{formatCurrency(group.collected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(data.groupBy === 'product' || data.groupBy === 'category') && (
              <p className="mt-2 text-xs text-muted-foreground">
                Product and category totals are line-item revenue, so they sum to gross sales rather
                than to the order total, which also carries shipping, tax and discount. A product in
                more than one category is counted under its primary category only.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage="The sales report could not be produced."
        onRetry={refetch}
        emptyState={{
          icon: ReceiptText,
          title: 'No orders match the current filters',
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
