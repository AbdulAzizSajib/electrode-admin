/**
 * Abandoned carts — carts shoppers filled and left (items untouched for 24h).
 * Follows the same envelope/error pattern as `audit-logs.ts`.
 *
 * Reads are open to every admin role; deleting and purging are OWNER/ADMIN
 * only, and the backend answers STAFF with 403 regardless of what the page
 * shows. See server/openspec/changes/add-abandoned-carts-admin.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type PaginatedResponse } from '@/lib/api/client'
import { request, requestData } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export interface AbandonedCartItem {
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  quantity: number
  /** What the shopper would be charged now, campaign price included. */
  unitPrice: number
  lineTotal: number
}

export interface AbandonedCart {
  id: string
  isGuest: boolean
  /** Null for a guest cart — a guest leaves no name, phone or email behind. */
  customer: { name: string; phone: string | null; email: string | null } | null
  items: AbandonedCartItem[]
  itemCount: number
  total: number
  /** ISO time of the newest item add or change. */
  lastActivityAt: string
}

export interface AbandonedCartSummary {
  total: number
  customer: number
  guest: number
  value: number
}

/** The ages a guest-cart purge may choose — mirrors `GUEST_PURGE_AGE_DAYS` in the server's cart.constant.ts. */
export const GUEST_PURGE_AGE_DAYS = [7, 30, 90] as const
export type GuestPurgeAgeDays = (typeof GUEST_PURGE_AGE_DAYS)[number]

export interface PurgeCartsPayload {
  guestOlderThanDays?: GuestPurgeAgeDays
  emptyCarts?: boolean
}

export interface AbandonedCartListParams {
  page?: number
  limit?: number
}

async function listAbandonedCarts(
  params: AbandonedCartListParams = {},
): Promise<PaginatedResponse<AbandonedCart>> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const res = await request<AbandonedCart[]>(`/abandoned-carts?page=${page}&limit=${limit}`)
  return {
    data: res.data,
    meta: res.meta ?? { page, limit, total: res.data.length, totalPages: 1 },
  }
}

function getAbandonedCartSummary(): Promise<AbandonedCartSummary> {
  return requestData<AbandonedCartSummary>('/abandoned-carts/summary')
}

function deleteCarts(ids: string[]): Promise<{ deleted: number }> {
  return requestData<{ deleted: number }>('/abandoned-carts', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

function purgeCarts(payload: PurgeCartsPayload): Promise<{ guest: number; empty: number }> {
  return requestData<{ guest: number; empty: number }>('/abandoned-carts/purge', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function useAbandonedCarts(params: AbandonedCartListParams = {}) {
  return useQuery({
    queryKey: queryKeys.abandonedCarts.list(params),
    queryFn: () => listAbandonedCarts(params),
  })
}

export function useAbandonedCartSummary() {
  return useQuery({
    queryKey: queryKeys.abandonedCarts.summary(),
    queryFn: getAbandonedCartSummary,
  })
}

/** Both mutations change the list AND the summary, so both are dropped. */
function useInvalidateAbandonedCarts() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.abandonedCarts.all })
}

export function useDeleteCarts() {
  const invalidate = useInvalidateAbandonedCarts()
  return useMutation({ mutationFn: deleteCarts, onSuccess: invalidate })
}

export function usePurgeCarts() {
  const invalidate = useInvalidateAbandonedCarts()
  return useMutation({ mutationFn: purgeCarts, onSuccess: invalidate })
}
