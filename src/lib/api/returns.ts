/**
 * Real backend return calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 * No create function here: returns are customer-created only (`POST /orders/:id/returns`, always
 * scoped to the caller's own order) — there's no admin "create a return" capability to wrap.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type ListParams, type PaginatedResponse, type PaginationMeta } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'

interface ReturnOrderItemRef {
  productId: string
  productName: string
  sku: string | null
  quantity: number
}

export interface ReturnItem {
  id: string
  orderItemId: string
  orderItem: ReturnOrderItemRef
  quantity: number
  reason: string | null
}

export interface ReturnOrderRef {
  id: string
  orderNumber: string
  status: string
}

export interface ReturnRequest {
  id: string
  returnNumber: string
  orderId: string
  order: ReturnOrderRef
  customerId: string
  reason: string
  description: string | null
  status: ReturnStatus
  items: ReturnItem[]
  createdAt: string
  updatedAt: string
}

export interface ReturnListParams extends ListParams {
  status?: ReturnStatus
  orderId?: string
}

export interface UpdateReturnStatusInput {
  status: ReturnStatus
  /** Required only when `status` is `COMPLETED` — the warehouse that receives the restocked items. */
  warehouseId?: string
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message ?? `Request to ${path} failed`, res.status)
  }
  return json
}

async function listReturns(params: ReturnListParams = {}): Promise<PaginatedResponse<ReturnRequest>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)
  if (params.orderId) query.set('orderId', params.orderId)

  const res = await request<ReturnRequest[]>(`/returns?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getReturn(id: string): Promise<ReturnRequest> {
  const res = await request<ReturnRequest>(`/returns/${id}`)
  return res.data
}

async function updateReturnStatus(id: string, input: UpdateReturnStatusInput): Promise<ReturnRequest> {
  const res = await request<ReturnRequest>(`/returns/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

export function useReturns(params: ReturnListParams = {}) {
  return useQuery({ queryKey: queryKeys.returns.list(params), queryFn: () => listReturns(params) })
}

export function useReturn(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.returns.detail(id ?? ''), queryFn: () => getReturn(id!), enabled: !!id })
}

export function useUpdateReturnStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReturnStatusInput }) => updateReturnStatus(id, input),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: queryKeys.returns.all })
      client.invalidateQueries({ queryKey: queryKeys.returns.detail(v.id) })
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}
