import * as React from 'react'
import { Bell, Check, CheckCheck, LifeBuoy, Package, Settings as SettingsIcon, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DataPagination } from '@/components/ui/pagination'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, type NotificationType } from '@/lib/api/notifications'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  order: ShoppingCart,
  support: LifeBuoy,
  inventory: Package,
  system: SettingsIcon,
}

export default function NotificationsPage() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  const { data, isLoading } = useNotifications({ page, limit: pageSize })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.data ?? []
  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notifications"
        description="Recent activity across your store."
        actions={
          <Button variant="outline" size="sm" disabled={!hasUnread} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type]
            return (
              <Card key={n.id} className={cn('flex items-center gap-3 p-2.5', !n.isRead && 'border-primary/30 bg-info-bg')}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-1 flex-col">
                  <span className={cn('text-sm', !n.isRead ? 'font-medium text-foreground' : 'text-foreground')}>{n.message}</span>
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
