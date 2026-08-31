/** Real backend notification calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const NOTIFICATION_TYPES = [
  'ORDER',
  'PAYMENT',
  'PRODUCT',
  'INVENTORY',
  'CUSTOMER',
  'REVIEW',
  'RETURN',
  'REFUND',
  'SUPPORT',
  'SYSTEM',
  'MARKETING',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number]

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  priority: NotificationPriority
  /** Split from `message` — the mock had a single text blob; the backend has both. */
  title: string
  message: string
  link: string | null
  isRead: boolean
  readAt: string | null
  channel: NotificationChannel
  createdAt: string
}

export interface NotificationListParams extends ListParams {
  isRead?: boolean
  type?: NotificationType
  priority?: NotificationPriority
}

function buildQuery(params: NotificationListParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(params.limit ?? 20))
  if (params.isRead !== undefined) query.set('isRead', String(params.isRead))
  if (params.type) query.set('type', params.type)
  if (params.priority) query.set('priority', params.priority)
  return query
}

async function listNotifications(params: NotificationListParams = {}): Promise<PaginatedResponse<AppNotification>> {
  const query = buildQuery(params)
  const res = await request<AppNotification[]>(`/notifications?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: res.data.length,
      totalPages: 1,
    },
  }
}

/**
 * Exact unread count for the header badge.
 *
 * The backend has no dedicated count endpoint, but `isRead` is a filterable field, so asking for a
 * single unread row and reading `meta.total` gives the true count across all history rather than
 * the page-scoped approximation a client-side filter over the list would produce.
 */
async function unreadCount(): Promise<number> {
  const res = await request<AppNotification[]>('/notifications?isRead=false&limit=1')
  return res.meta?.total ?? res.data.length
}

async function markAsRead(id: string): Promise<void> {
  await request<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH' })
}

async function markAllAsRead(): Promise<void> {
  await request<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' })
}

export function useNotifications(params: NotificationListParams = {}) {
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
