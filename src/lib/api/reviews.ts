/**
 * Real backend review calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 * No content-edit or delete here: neither endpoint exists on the backend (see
 * integrate-post-purchase-api design.md Decision 3) — status moderation and admin replies are the
 * only admin-side mutations available.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'

interface ReviewCustomerRef {
  id: string
  firstName: string
  lastName: string | null
  avatar: string | null
}

interface ReviewProductRef {
  id: string
  name: string
  slug: string
}

export interface Review {
  id: string
  productId: string
  /** Only present on admin-list responses. */
  product?: ReviewProductRef
  customerId: string
  customer: ReviewCustomerRef
  rating: number
  title: string | null
  comment: string | null
  status: ReviewStatus
  adminReply: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewListParams extends ListParams {
  status?: ReviewStatus
  productId?: string
  rating?: number
}

async function listReviews(params: ReviewListParams = {}): Promise<PaginatedResponse<Review>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.status) query.set('status', params.status)
  if (params.productId) query.set('productId', params.productId)
  if (params.rating) query.set('rating', String(params.rating))

  const res = await request<Review[]>(`/reviews/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
  const res = await request<Review>(`/reviews/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  return res.data
}

async function replyToReview(id: string, adminReply: string): Promise<Review> {
  const res = await request<Review>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ adminReply }) })
  return res.data
}

export function useReviews(params: ReviewListParams = {}) {
  return useQuery({ queryKey: queryKeys.reviews.list(params), queryFn: () => listReviews(params) })
}

export function useUpdateReviewStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) => updateReviewStatus(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reviews.all }),
  })
}

export function useReplyToReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, adminReply }: { id: string; adminReply: string }) => replyToReview(id, adminReply),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reviews.all }),
  })
}
