import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuditLogs, AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from '@/lib/api/audit-logs'
import { formatDateTime } from '@/lib/utils/format'

/** Pretty-prints a recorded state blob, or null when the entry has none. */
function StateBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-2.5 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function ChangeDetailDialog({ entry, onClose }: { entry: AuditLogEntry | null; onClose: () => void }) {
  const hasDetail = entry && (entry.oldData !== null || entry.newData !== null)

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? `${entry.action} ${entry.entity}` : 'Change detail'}</DialogTitle>
          <DialogDescription>
            {entry
              ? `${entry.user?.name ?? 'Unknown user'} · ${formatDateTime(entry.createdAt)}`
              : null}
          </DialogDescription>
        </DialogHeader>

        {hasDetail ? (
          <div className="flex flex-col gap-3">
            <StateBlock title="Before" value={entry.oldData} />
            <StateBlock title="After" value={entry.newData} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No change detail was recorded for this entry.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function AuditLogsPage() {
  const [action, setAction] = React.useState<'all' | AuditAction>('all')
  const [entity, setEntity] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [selected, setSelected] = React.useState<AuditLogEntry | null>(null)

  const { data, isLoading, isError, refetch } = useAuditLogs({
    page,
    limit: pageSize,
    action: action === 'all' ? undefined : action,
    entity: entity.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  })

  const columns: ColumnDef<AuditLogEntry>[] = [
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    {
      id: 'actor',
      header: 'Actor',
      // The relation is nullable — the acting user's account may since have been deleted.
      cell: ({ row }) =>
        row.original.user ? (
          <span className="font-medium text-foreground">{row.original.user.name}</span>
        ) : (
          <span className="text-muted-foreground">Unknown user</span>
        ),
    },
    { id: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
    { accessorKey: 'entity', header: 'Entity' },
    {
      id: 'entityId',
      header: 'Entity ID',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.entityId ?? '—'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit Logs" description="A read-only record of admin actions across the store." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: ScrollText, title: 'No audit entries yet' }}
        onRowClick={setSelected}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={action} onValueChange={(v) => { setAction(v as 'all' | AuditAction); setPage(1) }}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {AUDIT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              className="h-8 w-44"
              placeholder="Entity (e.g. Product)"
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setPage(1) }}
            />
            <Input
              type="date"
              className="h-8 w-36"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              className="h-8 w-36"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
            />
          </div>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <ChangeDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
