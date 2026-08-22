import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export type NotificationType = 'order' | 'support' | 'inventory' | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  message: string
  isRead: boolean
  createdAt: string
}

let notifications: AppNotification[] = [
  { id: generateId('ntf'), type: 'order', message: 'New order ORD-58219 was placed.', isRead: false, createdAt: new Date(Date.now() - 15 * 60_000).toISOString() },
  { id: generateId('ntf'), type: 'inventory', message: 'Aurora Smartphone X12 is low on stock (5 remaining).', isRead: false, createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString() },
  { id: generateId('ntf'), type: 'support', message: 'New support ticket: "Wrong item shipped".', isRead: false, createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString() },
  { id: generateId('ntf'), type: 'order', message: 'Order ORD-58201 was cancelled and refunded.', isRead: true, createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
  { id: generateId('ntf'), type: 'system', message: 'Store settings were updated by Marcus Webb.', isRead: true, createdAt: new Date(Date.now() - 48 * 3_600_000).toISOString() },
]

async function listNotifications(params: ListParams = {}): Promise<PaginatedResponse<AppNotification>> {
  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return delay(paginate(sorted, params))
}

async function unreadCount(): Promise<number> {
  return delay(notifications.filter((n) => !n.isRead).length, 150)
}

async function markAsRead(id: string): Promise<void> {
  notifications = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
  return delay(undefined)
}

async function markAllAsRead(): Promise<void> {
  notifications = notifications.map((n) => ({ ...n, isRead: true }))
  return delay(undefined)
}

export function useNotifications(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.notifications.list(params), queryFn: () => listNotifications(params) })
}

export function useUnreadNotificationCount() {
  return useQuery({ queryKey: queryKeys.notifications.unreadCount, queryFn: unreadCount, refetchInterval: 60_000 })
}

function invalidateNotifications(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: queryKeys.notifications.all })
  client.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
}

export function useMarkNotificationRead() {
  const client = useQueryClient()
  return useMutation({ mutationFn: markAsRead, onSuccess: () => invalidateNotifications(client) })
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient()
  return useMutation({ mutationFn: markAllAsRead, onSuccess: () => invalidateNotifications(client) })
}
