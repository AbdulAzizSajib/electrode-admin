/**
 * The change-probe behind the panel's live dashboard, backed by `GET /analytics/pulse`.
 *
 * Same envelope/error pattern as `dashboard.ts`, but a different kind of call: it carries no
 * `range`, returns a fixed small shape, and is polled on an interval rather than fetched per
 * page. Nothing here decides *when* to poll — that is `use-realtime.ts`.
 */
import { requestData } from '@/lib/api/request'

export interface PulseLatestOrder {
  id: string
  orderNumber: string
  totalAmount: number
  createdAt: string
}

export interface Pulse {
  latestOrder: PulseLatestOrder | null
  orderCount: number
  pendingOrderCount: number
  unreadNotificationCount: number
  lowStockCount: number
  lastEventAt: string | null
}

export function getPulse(): Promise<Pulse> {
  return requestData<Pulse>('/analytics/pulse')
}
