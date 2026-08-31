/**
 * Real backend refund calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 * No status-update function here: the backend has no endpoint that changes a refund's status once
 * created (see integrate-post-purchase-api design.md Decision 1) — refunds are create-and-list only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface RefundOrderRef {
  id: string
  orderNumber: string
}

export interface Refund {
  id: string
  orderId: string
  order: RefundOrderRef
  paymentId: string | null
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  amount: string
  reason: string | null
  status: RefundStatus
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RefundListParams extends ListParams {
  status?: RefundStatus
  orderId?: string
  paymentId?: string
}

export interface CreateRefundInput {
  amount: number
  reason?: string
  paymentId?: string
  returnRequestId?: string
}

async function listRefunds(params: RefundListParams = {}): Promise<PaginatedResponse<Refund>> {
  const limit = params.limit ?? 100

  // No searchTerm — GET /refunds has no free-text search, only these filters.
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.status) query.set('status', params.status)
  if (params.orderId) query.set('orderId', params.orderId)
  if (params.paymentId) query.set('paymentId', params.paymentId)

  const res = await request<Refund[]>(`/refunds?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function createRefund(orderId: string, input: CreateRefundInput): Promise<Refund> {
  const res = await request<Refund>(`/orders/${orderId}/refunds`, { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

export function useRefunds(params: RefundListParams = {}) {
  return useQuery({ queryKey: queryKeys.refunds.list(params), queryFn: () => listRefunds(params) })
}

export function useCreateRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateRefundInput }) => createRefund(orderId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.refunds.all }),
  })
}
