/** Real backend coupon calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const COUPON_TYPES = ['PERCENTAGE', 'FIXED', 'FREE_SHIPPING'] as const
export type CouponType = (typeof COUPON_TYPES)[number]

export const COUPON_STATUSES = ['ACTIVE', 'INACTIVE', 'EXPIRED'] as const
export type CouponStatus = (typeof COUPON_STATUSES)[number]

export interface Coupon {
  id: string
  code: string
  description: string | null
  type: CouponType
  /** Decimal, serialised as a string by the backend. */
  value: string
  /** Null means no floor at all, which is distinct from a floor of zero. */
  minimumOrderAmount: string | null
  maximumDiscountAmount: string | null
  /** Null means unlimited redemptions. */
  usageLimit: number | null
  usageCount: number
  perCustomerLimit: number | null
  /** Null on either side means that end of the validity window is open. */
  startsAt: string | null
  expiresAt: string | null
  status: CouponStatus
  createdAt: string
  updatedAt: string
}

export interface CouponInput {
  code: string
  description?: string
  type: CouponType
  value: number
  minimumOrderAmount?: number
  maximumDiscountAmount?: number
  usageLimit?: number
  perCustomerLimit?: number
  startsAt?: string
  expiresAt?: string
  status?: CouponStatus
  /** Restricts the coupon to specific products; omitted means it applies store-wide. */
  productIds?: string[]
}

export interface CouponListParams extends ListParams {
  status?: CouponStatus
  type?: CouponType
}

async function listCoupons(params: CouponListParams = {}): Promise<PaginatedResponse<Coupon>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)

  const res = await request<Coupon[]>(`/coupons?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getCoupon(id: string): Promise<Coupon> {
  const res = await request<Coupon>(`/coupons/${id}`)
  return res.data
}

async function createCoupon(input: CouponInput): Promise<Coupon> {
  const res = await request<Coupon>('/coupons', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
  const res = await request<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteCoupon(id: string): Promise<void> {
  await request<Coupon>(`/coupons/${id}`, { method: 'DELETE' })
}

export function useCoupons(params: CouponListParams = {}) {
  return useQuery({ queryKey: queryKeys.coupons.list(params), queryFn: () => listCoupons(params) })
}

export function useCoupon(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.coupons.detail(id ?? ''), queryFn: () => getCoupon(id!), enabled: !!id })
}

export function useCreateCoupon() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createCoupon,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.coupons.all }),
  })
}

export function useUpdateCoupon() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CouponInput }) => updateCoupon(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.coupons.all }),
  })
}

export function useDeleteCoupon() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.coupons.all }),
  })
}
