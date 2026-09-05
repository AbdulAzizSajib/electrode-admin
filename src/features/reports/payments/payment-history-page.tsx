import * as React from 'react'
import { Link } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { usePaymentReport, reportExports, type PaymentReportRow } from '@/lib/api/reports'
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

/**
 * Method options follow the selected direction: money-in methods are what a
 * customer can pay with, money-out methods are what the store can pay a
 * supplier with, and cash on delivery belongs only to the first
 * (`admin-reporting/payment-reports`).
 */
const IN_METHODS = [
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'CARD', label: 'Card' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
]

const OUT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

const IN_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
]

export default function PaymentHistoryPage() {
  const [range, setRange] = React.useState<DateRangeValue>(defaultDateRange)
  const [direction, setDirection] = React.useState(ALL_VALUE)
  const [method, setMethod] = React.useState(ALL_VALUE)
  const [status, setStatus] = React.useState(ALL_VALUE)
  const [supplierId, setSupplierId] = React.useState(ALL_VALUE)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const params = {
    ...range,
    page,
    limit: pageSize,
    direction: direction === ALL_VALUE ? undefined : (direction as 'IN' | 'OUT'),
    method: method === ALL_VALUE ? undefined : method,
    status: status === ALL_VALUE ? undefined : status,
    supplierId: supplierId === ALL_VALUE ? undefined : supplierId,
  }

  const { data, isLoading, isError, refetch } = usePaymentReport(params)
  const { data: suppliers } = useSuppliers({ limit: 200 })
  const summary = data?.summary

  // Direction narrows what a method or status can even mean, so the options
  // follow it — and a method that no longer exists in the narrowed set is
  // cleared rather than left applied invisibly.
  const methodOptions =
    direction === 'OUT' ? OUT_METHODS : direction === 'IN' ? IN_METHODS : [...IN_METHODS, ...OUT_METHODS.filter((m) => !IN_METHODS.some((i) => i.value === m.value))]

  const stats: ReportStat[] = [
    {
      label: 'Money in',
      value: formatCurrency(summary?.moneyIn ?? 0),
      tone: 'positive',
      hint: `${formatNumber(summary?.inCount ?? 0)} customer payment(s), settled only`,
    },
    {
      label: 'Money out',
      value: formatCurrency(summary?.moneyOut ?? 0),
      tone: 'negative',
      hint: `${formatNumber(summary?.outCount ?? 0)} supplier payment(s)`,
    },
    {
      label: 'Net movement',
      value: formatCurrency(summary?.net ?? 0),
      tone: summary && summary.net < 0 ? 'negative' : 'default',
    },
    {
      label: 'Pending',
      value: formatCurrency(summary?.pending ?? 0),
      tone: 'muted',
      hint: 'Recorded but not settled — not counted in money in',
    },
  ]

  const columns: ColumnDef<PaymentReportRow>[] = [
    {
      id: 'direction',
      header: 'Direction',
      cell: ({ row }) =>
        row.original.direction === 'IN' ? (
          <span className="flex items-center gap-1 font-medium text-success">
            <ArrowDownLeft className="size-3.5" /> In
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-destructive">
            <ArrowUpRight className="size-3.5" /> Out
          </span>
        ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{formatDate(row.original.effectiveDate)}</span>
          {!row.original.isSettled && (
            // The date shown is when the payment was RECORDED, not when money
            // moved — the page says so rather than implying settlement.
            <span className="text-xs text-muted-foreground">Record date</span>
          )}
        </div>
      ),
    },
    {
      id: 'counterparty',
      header: 'Counterparty',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.counterpartyName}
          {row.original.isGuest && <Badge variant="outline">Guest</Badge>}
        </span>
      ),
    },
    {
      id: 'document',
      header: 'Document',
      cell: ({ row }) => {
        if (!row.original.documentNumber) {
          return <span className="text-muted-foreground">No longer exists</span>
        }
        const to =
          row.original.direction === 'IN'
            ? `/sales/orders/${row.original.documentId}`
            : `/inventory/purchase-orders/${row.original.documentId}`
        return (
          <Link to={to} className="text-primary hover:underline">
            {row.original.documentNumber}
          </Link>
        )
      },
    },
    {
      id: 'method',
      header: 'Method',
      cell: ({ row }) => row.original.method.replace(/_/g, ' '),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isSettled ? 'success' : 'warning'}>
          {row.original.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span
          className={
            row.original.direction === 'IN'
              ? 'font-medium text-success'
              : 'font-medium text-destructive'
          }
        >
          {row.original.direction === 'IN' ? '+' : '−'}
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reference ?? '—'}</span>
      ),
    },
  ]

  const applied: AppliedFilter[] = [
    ...(direction !== ALL_VALUE
      ? [
          {
            label: direction === 'IN' ? 'Money in only' : 'Money out only',
            onClear: () => setDirection(ALL_VALUE),
          },
        ]
      : []),
    ...(method !== ALL_VALUE
      ? [{ label: `Method: ${method.replace(/_/g, ' ')}`, onClear: () => setMethod(ALL_VALUE) }]
      : []),
    ...(status !== ALL_VALUE
      ? [{ label: `Status: ${status.replace(/_/g, ' ')}`, onClear: () => setStatus(ALL_VALUE) }]
      : []),
    ...(supplierId !== ALL_VALUE
      ? [
          {
            label: `Supplier: ${suppliers?.data.find((s) => s.id === supplierId)?.name ?? supplierId}`,
            onClear: () => setSupplierId(ALL_VALUE),
          },
        ]
      : []),
  ]

  const clearAll = () => {
    setRange(defaultDateRange())
    setDirection(ALL_VALUE)
    setMethod(ALL_VALUE)
    setStatus(ALL_VALUE)
    setSupplierId(ALL_VALUE)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Payment history"
        description="Every movement of money in a period — received from customers and paid to suppliers — in one list."
      />

      <ReportSummary stats={stats} isLoading={isLoading} />

      <ReportToolbar
        applied={applied}
        onClearAll={clearAll}
        actions={<ExportButton onExport={() => reportExports.payments(params)} />}
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
          label="Direction"
          allLabel="Both directions"
          value={direction}
          onChange={(value) => {
            setDirection(value)
            // A method or status valid for the old direction may be
            // meaningless for the new one; cleared rather than left applied
            // and silently matching nothing.
            setMethod(ALL_VALUE)
            setStatus(ALL_VALUE)
            setPage(1)
          }}
          options={[
            { value: 'IN', label: 'Money in (customers)' },
            { value: 'OUT', label: 'Money out (suppliers)' },
          ]}
        />
        <ReportFilterSelect
          label="Method"
          allLabel="All methods"
          value={method}
          onChange={(value) => {
            setMethod(value)
            setPage(1)
          }}
          options={methodOptions}
        />
        {direction !== 'OUT' && (
          <ReportFilterSelect
            label="Status"
            allLabel="All statuses"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={IN_STATUSES}
          />
        )}
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
      </ReportToolbar>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage="The payment history could not be produced."
        onRetry={refetch}
        emptyState={{
          icon: Banknote,
          title: 'No payments match the current filters',
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
