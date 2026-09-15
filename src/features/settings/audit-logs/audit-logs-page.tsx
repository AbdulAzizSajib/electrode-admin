import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ScrollText, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { RequireRole } from '@/routes/guards'
import { useSessionStore } from '@/lib/store/session-store'
import {
  useAuditLogs,
  useDeleteAuditLogs,
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogEntry,
} from '@/lib/api/audit-logs'
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
  const [rawSelection, setSelection] = React.useState<string[]>([])

  const deleteMutation = useDeleteAuditLogs()
  const confirmDialog = useConfirmDialog()

  /*
   * The same role `RequireRole` below gates the button on, read directly
   * because the checkbox column is a prop rather than a child — it cannot be
   * wrapped. UI only: the backend rejects a non-OWNER purge with 403 regardless
   * of what this returns.
   */
  const canPurge = useSessionStore((s) => s.user?.role) === 'OWNER'

  const { data, isLoading, isError, refetch } = useAuditLogs({
    page,
    limit: pageSize,
    action: action === 'all' ? undefined : action,
    entity: entity.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  })

  /*
   * The selection, narrowed to the rows currently on screen.
   *
   * Derived during render rather than cleared from an effect on page/filter
   * change: an entry the merchant can no longer see must never be purged, and
   * deriving makes that structural rather than dependent on an effect firing
   * before the next click.
   */
  const visibleIds = React.useMemo(
    () => new Set((data?.data ?? []).map((row) => row.id)),
    [data],
  )
  const selection = React.useMemo(
    () => rawSelection.filter((id) => visibleIds.has(id)),
    [rawSelection, visibleIds],
  )

  const purgeSelected = () =>
    confirmDialog.confirm(async () => {
      const count = selection.length
      try {
        const { deleted } = await deleteMutation.mutateAsync(selection)
        setSelection([])
        toast({
          title: `${deleted} ${deleted === 1 ? 'entry' : 'entries'} deleted`,
          // Worth stating outright: the count can be lower than what was
          // selected if another session got there first, and the purge itself
          // adds a row. Neither is a failure, but both look like one.
          description:
            deleted < count
              ? `${count - deleted} had already been removed. The purge itself is recorded as a new entry.`
              : 'The purge itself is recorded as a new entry.',
        })
      } catch (err) {
        toast({
          title: 'Could not delete entries',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
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
      <PageHeader
        title="Audit Logs"
        description="A record of admin actions across the store. Entries are written automatically and cannot be edited."
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: ScrollText, title: 'No audit entries yet' }}
        onRowClick={setSelected}
        /*
         * Selection is offered to everyone who can reach this page, but the
         * action it feeds is OWNER-only below. Hiding the checkboxes from an
         * ADMIN would be tidier; showing them with no available action would be
         * worse. So the column is gated on the same role as the button.
         */
        selection={canPurge ? selection : undefined}
        onSelectionChange={canPurge ? setSelection : undefined}
        getRowId={canPurge ? (row) => row.id : undefined}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <RequireRole roles={['OWNER']}>
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                disabled={selection.length === 0 || deleteMutation.isPending}
                onClick={purgeSelected}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete{selection.length > 0 ? ` (${selection.length})` : ''}
              </Button>
            </RequireRole>
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

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title={`Delete ${selection.length} audit ${selection.length === 1 ? 'entry' : 'entries'}?`}
        /*
         * Names the real consequence rather than the generic one. An audit
         * entry is the record of what someone did; deleting it removes the only
         * evidence that the action happened.
         */
        description="This permanently removes the record of those actions. The deletion is itself recorded, but what was deleted cannot be recovered."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
