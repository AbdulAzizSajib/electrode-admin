import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { LifeBuoy } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSupportTickets, type TicketPriority, type TicketStatus } from '@/lib/api/support-tickets'
import { formatRelativeTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const STATUS_VARIANT: Record<TicketStatus, 'secondary' | 'warning' | 'success' | 'outline'> = { open: 'secondary', in_progress: 'warning', resolved: 'success', closed: 'outline' }
const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const PRIORITY_VARIANT: Record<TicketPriority, 'secondary' | 'outline' | 'warning' | 'destructive'> = { low: 'secondary', medium: 'outline', high: 'warning', urgent: 'destructive' }

interface TicketRow {
  id: string
  subject: string
  customerName: string
  status: TicketStatus
  priority: TicketPriority
  updatedAt: string
}

export default function SupportTicketsListPage() {
  const navigate = useNavigate()
  const [status, setStatus] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useSupportTickets({
    page,
    limit: pageSize,
    status: status === 'all' ? undefined : (status as TicketStatus),
    priority: priority === 'all' ? undefined : (priority as TicketPriority),
  })

  const columns: ColumnDef<TicketRow>[] = [
    { accessorKey: 'subject', header: 'Subject', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.subject}</span> },
    { accessorKey: 'customerName', header: 'Customer' },
    { id: 'priority', header: 'Priority', cell: ({ row }) => <Badge variant={PRIORITY_VARIANT[row.original.priority]}>{PRIORITY_LABEL[row.original.priority]}</Badge> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
    { accessorKey: 'updatedAt', header: 'Last updated', cell: ({ row }) => formatRelativeTime(row.original.updatedAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Support Tickets" description="Customer support conversations." />

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as TicketRow[]}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => navigate(`/support/tickets/${row.id}`)}
        emptyState={{ icon: LifeBuoy, title: 'No support tickets' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
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
