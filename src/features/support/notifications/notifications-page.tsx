import * as React from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CreditCard,
  LifeBuoy,
  Megaphone,
  Package,
  RotateCcw,
  Settings as SettingsIcon,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DataPagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  useDeleteNotifications,
  useDeleteReadNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationPriority,
  type NotificationType,
} from '@/lib/api/notifications'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  ORDER: ShoppingCart,
  PAYMENT: CreditCard,
  PRODUCT: Tag,
  INVENTORY: Package,
  CUSTOMER: Users,
  REVIEW: Star,
  RETURN: Undo2,
  REFUND: RotateCcw,
  SUPPORT: LifeBuoy,
  SYSTEM: SettingsIcon,
  MARKETING: Megaphone,
}

/** Only the two priorities worth calling out visually — LOW/MEDIUM are the unremarkable default. */
const PRIORITY_VARIANT: Partial<Record<NotificationPriority, 'destructive' | 'warning'>> = {
  URGENT: 'destructive',
  HIGH: 'warning',
}

type ReadFilter = 'all' | 'unread' | 'read'

export default function NotificationsPage() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('all')

  const { data, isLoading, error } = useNotifications({
    page,
    limit: pageSize,
    // `isRead` is a backend-filterable field, so this narrows the query rather than the page.
    isRead: readFilter === 'all' ? undefined : readFilter === 'read',
  })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const deleteSelected = useDeleteNotifications()
  const deleteRead = useDeleteReadNotifications()

  const [rawSelection, setSelection] = React.useState<string[]>([])
  const confirmDialog = useConfirmDialog()
  /*
   * Which confirmation is open. One dialog serves both destructive actions, so
   * it has to know which copy to show — "delete 3 selected" and "clear every
   * read notification" are different promises and must not be worded alike.
   */
  const [pendingAction, setPendingAction] = React.useState<'selected' | 'read'>('selected')

  // Memoised so the `?? []` fallback does not mint a new array every render and
  // invalidate the selection memos below.
  const notifications = React.useMemo(() => data?.data ?? [], [data])
  const hasUnread = notifications.some((n) => !n.isRead)
  const hasRead = notifications.some((n) => n.isRead)

  /*
   * The selection, narrowed to what is actually on screen.
   *
   * Derived during render rather than cleared from an effect on page/filter
   * change: an id the merchant can no longer see must never be deleted, and
   * deriving makes that structural instead of dependent on an effect firing
   * before the next click. It also avoids the cascading re-render a
   * `setSelection([])` in an effect would cause.
   *
   * `rawSelection` is still the stored state, so ticking a box, paging away and
   * paging back restores the ticks rather than silently dropping them.
   */
  const visibleIds = React.useMemo(() => new Set(notifications.map((n) => n.id)), [notifications])
  const selection = React.useMemo(
    () => rawSelection.filter((id) => visibleIds.has(id)),
    [rawSelection, visibleIds],
  )

  const allOnPageSelected = notifications.length > 0 && selection.length === notifications.length

  const toggleAllOnPage = () => {
    const pageIds = notifications.map((n) => n.id)
    setSelection((current) =>
      allOnPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    )
  }

  const toggleOne = (id: string) => {
    setSelection((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  /*
   * `which` is an argument rather than read from `pendingAction`. Both are set
   * in the same handler, but the callback handed to `confirm` closes over the
   * render it was created in — so reading the state variable here would use the
   * value from *before* `setPendingAction`, and "clear all read" would run the
   * selected-ids delete. `pendingAction` drives the dialog's copy only.
   */
  const runDelete = async (which: 'selected' | 'read') => {
    try {
      const { deleted } =
        which === 'selected'
          ? await deleteSelected.mutateAsync(selection)
          : await deleteRead.mutateAsync()
      setSelection([])
      toast({
        title: `${deleted} notification${deleted === 1 ? '' : 's'} deleted`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Could not delete notifications',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const askDelete = (which: 'selected' | 'read') => {
    setPendingAction(which)
    confirmDialog.confirm(() => runDelete(which))
  }

  const changeFilter = (value: ReadFilter) => {
    setReadFilter(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notifications"
        description="Recent activity across your store."
        actions={
          <>
            <Button variant="outline" size="lg" disabled={!hasUnread} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
              <CheckCheck /> Mark all as read
            </Button>
            {/*
              Clears every read notification store-wide, not just this page —
              the label says "read" rather than "all" because unread ones are
              deliberately spared. Enabled off `hasRead` on the current page,
              which is the only signal available without a second query; the
              call itself is not page-scoped.
            */}
            <Button
              variant="outline"
              size="lg"
              disabled={!hasRead || deleteRead.isPending}
              onClick={() => askDelete('read')}
              loading={deleteRead.isPending}
            >
              <Trash2 /> Clear read
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={readFilter} onValueChange={(v) => changeFilter(v as ReadFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notifications</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="read">Read only</SelectItem>
          </SelectContent>
        </Select>

        {notifications.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Select all on this page" />
            Select all on this page
          </label>
        )}

        {selection.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            disabled={deleteSelected.isPending}
            onClick={() => askDelete('selected')}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete ({selection.length})
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load notifications.'}
        </p>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description={readFilter === 'unread' ? "You're all caught up." : 'Nothing to show for this filter.'}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? AlertTriangle
            const priorityVariant = PRIORITY_VARIANT[n.priority]
            return (
              <Card key={n.id} className={cn('flex items-center gap-3 p-2.5', !n.isRead && 'border-primary/30 bg-info-bg')}>
                <Checkbox
                  checked={selection.includes(n.id)}
                  onCheckedChange={() => toggleOne(n.id)}
                  aria-label={`Select ${n.title}`}
                />
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm', !n.isRead && 'font-medium')}>{n.title}</span>
                    {priorityVariant && <Badge variant={priorityVariant}>{n.priority}</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">{n.message}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => markRead.mutate(n.id)} aria-label="Mark as read">
                    <Check className="size-4" />
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {data && data.meta.total > 0 && (
        <DataPagination
          page={page}
          pageCount={data.meta.totalPages}
          pageSize={pageSize}
          total={data.meta.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title={
          pendingAction === 'selected'
            ? `Delete ${selection.length} notification${selection.length === 1 ? '' : 's'}?`
            : 'Clear all read notifications?'
        }
        description={
          pendingAction === 'selected'
            ? 'This cannot be undone.'
            : 'Every notification you have already read will be removed. Unread ones are kept.'
        }
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
