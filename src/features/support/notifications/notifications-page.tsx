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
  Undo2,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DataPagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
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

  const notifications = data?.data ?? []
  const hasUnread = notifications.some((n) => !n.isRead)

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
          <Button variant="outline" size="lg" disabled={!hasUnread} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <Select value={readFilter} onValueChange={(v) => changeFilter(v as ReadFilter)}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All notifications</SelectItem>
          <SelectItem value="unread">Unread only</SelectItem>
          <SelectItem value="read">Read only</SelectItem>
        </SelectContent>
      </Select>

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
    </div>
  )
}
