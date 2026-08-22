import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export type DiscountType = 'percentage' | 'fixed'

export interface Coupon {
  id: string
  code: string
  discountType: DiscountType
  discountValue: number
  usageLimit: number
  usageCount: number
  minOrderAmount: number
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
}

export interface CouponInput {
  code: string
  discountType: DiscountType
  discountValue: number
  usageLimit: number
  minOrderAmount: number
  startDate: string
  endDate: string
  isActive: boolean
}

let coupons: Coupon[] = [
  { id: generateId('cpn'), code: 'WELCOME10', discountType: 'percentage', discountValue: 10, usageLimit: 1000, usageCount: 342, minOrderAmount: 0, startDate: '2025-11-01', endDate: '2026-12-31', isActive: true, createdAt: '2025-11-01T09:00:00Z' },
  { id: generateId('cpn'), code: 'FREESHIP50', discountType: 'fixed', discountValue: 5.99, usageLimit: 500, usageCount: 118, minOrderAmount: 50, startDate: '2025-12-01', endDate: '2026-03-31', isActive: true, createdAt: '2025-12-01T09:00:00Z' },
  { id: generateId('cpn'), code: 'HOLIDAY25', discountType: 'percentage', discountValue: 25, usageLimit: 300, usageCount: 300, minOrderAmount: 100, startDate: '2025-12-15', endDate: '2026-01-05', isActive: false, createdAt: '2025-12-10T09:00:00Z' },
]

async function listCoupons(params: ListParams = {}): Promise<PaginatedResponse<Coupon>> {
  const filtered = coupons.filter((c) => matchesSearch([c.code], params.search))
  return delay(paginate(filtered, params))
}

function codeTaken(code: string, excludeId?: string) {
  return coupons.some((c) => c.code.toLowerCase() === code.toLowerCase() && c.id !== excludeId)
}

async function createCoupon(input: CouponInput): Promise<Coupon> {
  if (codeTaken(input.code)) throw new ApiError('A coupon with this code already exists.', 409)
  if (input.endDate < input.startDate) throw new ApiError('End date must be after the start date.', 422)
  const coupon: Coupon = { id: generateId('cpn'), usageCount: 0, createdAt: new Date().toISOString(), ...input }
  coupons = [coupon, ...coupons]
  recordAuditEntry({ action: 'coupon.created', resourceType: 'coupon', resourceId: coupon.id, resourceLabel: coupon.code })
  return delay(coupon)
}

async function updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
  const index = coupons.findIndex((c) => c.id === id)
  if (index === -1) throw new ApiError('Coupon not found', 404)
  if (codeTaken(input.code, id)) throw new ApiError('A coupon with this code already exists.', 409)
  if (input.endDate < input.startDate) throw new ApiError('End date must be after the start date.', 422)
  const updated = { ...coupons[index], ...input }
  coupons = coupons.map((c) => (c.id === id ? updated : c))
  recordAuditEntry({ action: 'coupon.updated', resourceType: 'coupon', resourceId: id, resourceLabel: updated.code })
  return delay(updated)
}

async function deleteCoupon(id: string): Promise<void> {
  const target = coupons.find((c) => c.id === id)
  coupons = coupons.filter((c) => c.id !== id)
  recordAuditEntry({ action: 'coupon.deleted', resourceType: 'coupon', resourceId: id, resourceLabel: target?.code })
  return delay(undefined)
}

export function useCoupons(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.coupons.list(params), queryFn: () => listCoupons(params) })
}

export function useCreateCoupon() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createCoupon, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.coupons.all }) })
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
  return useMutation({ mutationFn: deleteCoupon, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.coupons.all }) })
}
