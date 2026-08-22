import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useAuditActors, useAuditLogs, type AuditLogEntry } from '@/lib/api/audit-logs'
import { formatDateTime } from '@/lib/utils/format'

export default function AuditLogsPage() {
  const [actorId, setActorId] = React.useState('all')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const { data, isLoading, isError, refetch } = useAuditLogs({
    page,
    limit: pageSize,
    actorId: actorId === 'all' ? undefined : actorId,
    from: from || undefined,
    to: to || undefined,
  })
  const { data: actors } = useAuditActors()

  const columns: ColumnDef<AuditLogEntry>[] = [
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { accessorKey: 'actorName', header: 'Actor', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.actorName}</span> },
    { id: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
    { accessorKey: 'resourceType', header: 'Resource' },
    { accessorKey: 'resourceLabel', header: 'Details', cell: ({ row }) => <span className="text-muted-foreground">{row.original.resourceLabel ?? '—'}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit Logs" description="A record of admin actions across the store." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: ScrollText, title: 'No audit entries yet' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={actorId} onValueChange={(v) => { setActorId(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Actor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {actors?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" className="h-8 w-36" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="h-8 w-36" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
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
