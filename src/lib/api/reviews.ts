import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllProducts } from '@/lib/api/products'
import { _getAllUsers } from '@/lib/api/users'

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface Review {
  id: string
  productId: string
  customerId: string
  rating: number
  comment: string
  status: ReviewStatus
  createdAt: string
}

function seedReviews(): Review[] {
  const products = _getAllProducts()
  const customers = _getAllUsers().filter((u) => u.role === 'CUSTOMER')
  const comments = [
    'Exactly as described, fast shipping!',
    'Good value for the price, would buy again.',
    'Not as durable as I hoped, broke after a month.',
    'Excellent build quality and great customer support.',
    'Arrived late but the product itself is great.',
    'Does not match the photos, disappointed.',
  ]
  return Array.from({ length: 14 }).map((_, i) => ({
    id: generateId('rev'),
    productId: products[i % products.length].id,
    customerId: customers[i % customers.length].id,
    rating: [5, 4, 3, 5, 2, 4, 5][i % 7],
    comment: comments[i % comments.length],
    status: (['approved', 'approved', 'pending', 'approved', 'rejected', 'pending'] as ReviewStatus[])[i % 6],
    createdAt: new Date(Date.now() - (i + 1) * 86_400_000 * 2).toISOString(),
  }))
}

let reviews: Review[] = seedReviews()

export interface ReviewListParams extends ListParams {
  status?: ReviewStatus
  rating?: number
}

async function listReviews(params: ReviewListParams = {}) {
  const products = _getAllProducts()
  const customers = _getAllUsers()
  let filtered = [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (params.status) filtered = filtered.filter((r) => r.status === params.status)
  if (params.rating) filtered = filtered.filter((r) => r.rating === params.rating)
  const rows = filtered.map((r) => ({
    ...r,
    productName: products.find((p) => p.id === r.productId)?.name ?? 'Unknown product',
    customerName: customers.find((c) => c.id === r.customerId)?.name ?? 'Unknown customer',
  }))
  return delay(paginate(rows, params) as PaginatedResponse<(typeof rows)[number]>)
}

async function updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
  const index = reviews.findIndex((r) => r.id === id)
  if (index === -1) throw new ApiError('Review not found', 404)
  const updated = { ...reviews[index], status }
  reviews = reviews.map((r) => (r.id === id ? updated : r))
  recordAuditEntry({ action: 'review.status_updated', resourceType: 'review', resourceId: id, resourceLabel: `→ ${status}` })
  return delay(updated)
}

async function updateReviewContent(id: string, comment: string): Promise<Review> {
  const index = reviews.findIndex((r) => r.id === id)
  if (index === -1) throw new ApiError('Review not found', 404)
  const updated = { ...reviews[index], comment }
  reviews = reviews.map((r) => (r.id === id ? updated : r))
  return delay(updated)
}

async function deleteReview(id: string): Promise<void> {
  reviews = reviews.filter((r) => r.id !== id)
  recordAuditEntry({ action: 'review.deleted', resourceType: 'review', resourceId: id })
  return delay(undefined)
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

export function useUpdateReviewContent() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) => updateReviewContent(id, comment),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reviews.all }),
  })
}

export function useDeleteReview() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteReview, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reviews.all }) })
}
