import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgeCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Alert } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import { usePendingVerifications, type PendingVerification } from '@/lib/api/payments'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

/**
 * Every advance payment claim nobody has decided yet, across every order.
 *
 * This page exists to answer a risk the feature creates rather than a feature
 * request: a shopper who sends ৳130 has paid real money, and their order cannot
 * ship until someone reads a statement and says the money arrived. Without a
 * list, claims are only visible on an order somebody happens to open, so the
 * ones nobody opens are the ones a shopper has already paid for. See
 * server/openspec/changes/add-advance-payment-checkout, design.md — Risks.
 *
 * A page rather than a filter on the orders list (design.md left the choice
 * open): the backend surface built for this returns PAYMENTS, and the queue's
 * useful columns — reference, sender, which account — are payment fields the
 * orders list has no place for.
 *
 * Deciding happens on the order, not here. A row navigates to the order detail,
 * where the claim panel carries the Verify and Reject controls next to the items,
 * the address and the delivery charge — the context the spec requires staff to
 * have without consulting another screen. Duplicating the decision here would
 * mean deciding with less to go on than the panel already shows.
 *
 * No `RoleGuard` on the route, matching `/sales/orders/new`: the backend gates
 * `GET /payments/pending-verification` on ADMIN_PANEL_ROLES, which is
 * OWNER/ADMIN/STAFF — exactly the three values `AdminRole` can take, so a guard
 * naming all three would restrict nobody while reading as a restriction.
 */

/** Oldest first — the queue is worked from the back, where a shopper has waited longest. */
const byOldestFirst = (a: PendingVerification, b: PendingVerification) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

const methodLabel: Record<string, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  BANK_TRANSFER: 'Bank transfer',
}

/** How long this shopper has been waiting, in the coarsest unit that is honest. */
const waitingFor = (createdAt: string): string => {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function PaymentVerificationsPage() {
  const navigate = useNavigate()
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const { data, isLoading, isError, refetch } = usePendingVerifications()

  /*
   * Paged in the client, because the endpoint returns the whole queue. That is
   * the right shape for it: a queue that is long is a problem to see all of, not
   * to page through, and the backend's own index is what keeps reading it cheap.
   */
  const rows = React.useMemo(() => [...(data ?? [])].sort(byOldestFirst), [data])
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  const columns: ColumnDef<PendingVerification>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.order.orderNumber}</span>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => {
        const customer = row.original.order.customer
        if (!customer) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-col">
            <span>{`${customer.firstName} ${customer.lastName ?? ''}`.trim()}</span>
            {customer.phone && (
              <span className="text-xs text-muted-foreground">{customer.phone}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'claimed',
      header: 'Claimed',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(Number(row.original.amount))}
          </span>
          {/* The order total beside it, because the difference is what says
              whether this is a delivery charge or the whole thing. */}
          <span className="text-xs text-muted-foreground tabular-nums">
            of {formatCurrency(Number(row.original.order.totalAmount))}
          </span>
        </div>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      cell: ({ row }) => methodLabel[row.original.method] ?? row.original.method.replace(/_/g, ' '),
    },
    {
      id: 'reference',
      header: 'Reference',
      /* Monospaced: this is the value read character by character against a
         statement, and a proportional font hides a transposed pair. */
      cell: ({ row }) => (
        <span className="break-all font-mono text-xs">{row.original.transactionId ?? '—'}</span>
      ),
    },
    {
      id: 'sender',
      header: 'Sender',
      cell: ({ row }) => (
        <span className="break-all font-mono text-xs">{row.original.senderIdentifier ?? '—'}</span>
      ),
    },
    {
      id: 'waiting',
      header: 'Waiting',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{waitingFor(row.original.createdAt)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Payment verification"
        description="Advance payments a shopper says they have sent, waiting for someone to check a statement. Nothing here can be dispatched until it is decided."
      />

      {/* Stated on the page rather than left to be learned: an operator who
          thinks these orders are simply pending will not understand why they
          cannot be confirmed. */}
      {rows.length > 0 && (
        <Alert>
          {rows.length === 1 ? 'One order is' : `${rows.length} orders are`} held until their payment
          is verified. Open one to see the claim and verify or reject it.
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={pageRows}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => navigate(`/sales/orders/${row.order.id}`)}
        emptyState={{
          icon: BadgeCheck,
          title: 'Nothing waiting to be verified',
          description:
            'Advance payments appear here as shoppers claim them. An empty list means every claim has been decided.',
        }}
        page={page}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        hidePagerWhenSinglePage
      />
    </div>
  )
}
