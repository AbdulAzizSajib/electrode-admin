import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { LifeBuoy } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useSupportTickets,
  customerName,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_VARIANT,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_VARIANT,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/api/support-tickets'
import { formatRelativeTime } from '@/lib/utils/format'

export default function SupportTicketsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useSupportTickets({
    search,
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as TicketStatus),
    priority: priority === 'all' ? undefined : (priority as TicketPriority),
  })

  const columns: ColumnDef<SupportTicket>[] = [
    {
      accessorKey: 'ticketNumber',
      header: 'Ticket',
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.ticketNumber}</span>,
    },
    { accessorKey: 'subject', header: 'Subject', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.subject}</span> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => customerName(row.original) },
    {
      id: 'assignedTo',
      header: 'Assignee',
      cell: ({ row }) =>
        row.original.assignedTo ? (
          row.original.assignedTo.name
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }) => <Badge variant={TICKET_PRIORITY_VARIANT[row.original.priority]}>{TICKET_PRIORITY_LABEL[row.original.priority]}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={TICKET_STATUS_VARIANT[row.original.status]}>{TICKET_STATUS_LABEL[row.original.status]}</Badge>,
    },
    { accessorKey: 'updatedAt', header: 'Last updated', cell: ({ row }) => formatRelativeTime(row.original.updatedAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Support Tickets" description="Customer support conversations." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by ticket number or subject…"
        onRowClick={(row) => navigate(`/support/tickets/${row.id}`)}
        emptyState={{ icon: LifeBuoy, title: 'No support tickets' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{TICKET_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABEL[p]}</SelectItem>)}
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
