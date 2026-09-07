/**
 * Real backend refund calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 *
 * Refunds were create-and-list only, which made a mistyped amount permanent: a
 * compensating second refund cannot express the correction, since amounts must
 * be positive. `add-admin-correction-paths` added amend and void — void being a
 * status change to CANCELLED rather than a delete, because a refund that
 * existed is a thing that happened and the payments report has already shown it.
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
  /**
   * Set when the returned goods physically came back and should be restocked
   * into this warehouse. Omitting it records a refund for goods the customer
   * keeps. Only meaningful alongside `returnRequestId` — completing a return
   * used to mean two different things about stock depending on which endpoint
   * did it, and this is how the caller now says which happened.
   */
  restockWarehouseId?: string
}

/** Only the figures are amendable — void and re-issue to change which payment or return a refund covers. */
export interface UpdateRefundInput {
  amount?: number
  reason?: string
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

async function updateRefund(refundId: string, input: UpdateRefundInput): Promise<Refund> {
  const res = await request<Refund>(`/refunds/${refundId}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function voidRefund(refundId: string): Promise<Refund> {
  const res = await request<Refund>(`/refunds/${refundId}/void`, { method: 'PATCH' })
  return res.data
}

export function useCreateRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateRefundInput }) => createRefund(orderId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.refunds.all }),
  })
}

export function useUpdateRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ refundId, input }: { refundId: string; input: UpdateRefundInput }) => updateRefund(refundId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.refunds.all }),
  })
}

export function useVoidRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (refundId: string) => voidRefund(refundId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.refunds.all })
      // Voiding restores the payment's status, the return it completed and the
      // product's sold count — every one of those is stale until refetched.
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
      client.invalidateQueries({ queryKey: queryKeys.returns.all })
      client.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
