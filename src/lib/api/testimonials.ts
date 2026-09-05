/** Real backend testimonial calls — follows the same envelope/error pattern as `pages.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const TESTIMONIAL_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number]

/** Mirrors the backend's `MIN_TESTIMONIAL_RATING` / `MAX_TESTIMONIAL_RATING`. Whole stars only. */
export const TESTIMONIAL_RATINGS = [1, 2, 3, 4, 5] as const

export interface Testimonial {
  id: string
  quote: string
  authorName: string
  /** The caption under the name — "Verified Buyer", "CEO, Acme". Free text. */
  authorRole: string
  /** Null renders as the author's initials on the storefront, never as a gap. */
  photoUrl: string | null
  rating: number
  status: TestimonialStatus
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TestimonialInput {
  quote: string
  authorName: string
  authorRole: string
  photoUrl?: string
  rating?: number
  status?: TestimonialStatus
  sortOrder?: number
}

export interface TestimonialListParams extends ListParams {
  status?: TestimonialStatus
}

/**
 * The list response carries the homepage section's own capacity.
 *
 * Served rather than hardcoded here for the reason `/pages/reserved-slugs` is: admin and the
 * storefront are separate deployments, so a copy in this file would drift the moment the section's
 * layout changed — and a label promising "only the first four appear" has to be reading the four
 * from whoever enforces it.
 */
export interface TestimonialListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  homeSectionCount?: number
}

async function listTestimonials(
  params: TestimonialListParams = {},
): Promise<PaginatedResponse<Testimonial> & { meta: TestimonialListMeta }> {
  const limit = params.limit ?? 50

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<Testimonial[]>(`/testimonials/admin?${query}`)
  return {
    data: res.data,
    meta: (res.meta as TestimonialListMeta | undefined) ?? {
      page: params.page ?? 1,
      limit,
      total: res.data.length,
      totalPages: 1,
    },
  }
}

async function getTestimonial(id: string): Promise<Testimonial> {
  const res = await request<Testimonial>(`/testimonials/admin/${id}`)
  return res.data
}

async function createTestimonial(input: TestimonialInput): Promise<Testimonial> {
  const res = await request<Testimonial>('/testimonials', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateTestimonial(
  id: string,
  input: Partial<TestimonialInput>,
): Promise<Testimonial> {
  const res = await request<Testimonial>(`/testimonials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

async function deleteTestimonial(id: string): Promise<void> {
  await request<Testimonial>(`/testimonials/${id}`, { method: 'DELETE' })
}

export function useTestimonials(params: TestimonialListParams = {}) {
  return useQuery({
    queryKey: queryKeys.testimonials.list(params),
    queryFn: () => listTestimonials(params),
  })
}

export function useTestimonial(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.testimonials.detail(id ?? ''),
    queryFn: () => getTestimonial(id!),
    enabled: !!id,
  })
}

export function useCreateTestimonial() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createTestimonial,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.testimonials.all }),
  })
}

export function useUpdateTestimonial() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TestimonialInput> }) =>
      updateTestimonial(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.testimonials.all }),
  })
}

export function useDeleteTestimonial() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteTestimonial,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.testimonials.all }),
  })
}
