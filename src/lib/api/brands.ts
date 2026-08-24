/**
 * Real backend brand calls — unlike most other `src/lib/api/*` modules (still mock-data, see
 * client.ts), this one talks to the live Express API directly. Follows the same envelope/error
 * pattern as `src/lib/api/categories.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type ListParams, type PaginatedResponse, type PaginationMeta } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export interface Brand {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  status: boolean
  createdAt: string
  updatedAt: string
}

export interface BrandInput {
  name: string
  description?: string
  logo?: string
  status?: boolean
}

export interface BrandListParams extends ListParams {
  status?: boolean
}

export interface BulkCreateBrandsResult {
  created: Array<{ id: string; name: string; slug: string }>
  skipped: Array<{ name: string; reason: string }>
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta
}

/** One shared fetch helper: unwraps the `{ success, message, data }` envelope, throws on failure. */
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

async function listBrands(params: BrandListParams = {}): Promise<PaginatedResponse<Brand>> {
  // Callers that just need "every brand" for a picker (product forms) call useBrands() with no
  // params at all — default high enough that those keep working without pagination, matching the
  // same convention categories.ts uses for the same reason.
  const limit = params.limit ?? 100

  // Only add query params that actually have a value.
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status !== undefined) query.set('status', String(params.status))

  const res = await request<Brand[]>(`/brands/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getBrand(id: string): Promise<Brand> {
  const res = await request<Brand>(`/brands/admin/${id}`)
  return res.data
}

async function createBrand(input: BrandInput): Promise<Brand> {
  const res = await request<Brand>('/brands', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateBrand(id: string, input: BrandInput): Promise<Brand> {
  const res = await request<Brand>(`/brands/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function bulkCreateBrands(names: string[]): Promise<BulkCreateBrandsResult> {
  const res = await request<BulkCreateBrandsResult>('/brands/bulk', { method: 'POST', body: JSON.stringify({ names }) })
  return res.data
}

async function deleteBrand(id: string): Promise<void> {
  await request<Brand>(`/brands/${id}`, { method: 'DELETE' })
}

export function useBrands(params: BrandListParams = {}) {
  return useQuery({ queryKey: queryKeys.brands.list(params), queryFn: () => listBrands(params) })
}

export function useBrand(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.brands.detail(id ?? ''), queryFn: () => getBrand(id!), enabled: !!id })
}

export function useCreateBrand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }),
  })
}

export function useUpdateBrand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrandInput }) => updateBrand(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }),
  })
}

export function useBulkCreateBrands() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: bulkCreateBrands,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }),
  })
}

export function useDeleteBrand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }),
  })
}
