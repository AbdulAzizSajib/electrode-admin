/**
 * Real backend brand calls — unlike most other `src/lib/api/*` modules (still mock-data, see
 * client.ts), this one talks to the live Express API directly. Follows the same envelope/error
 * pattern as `src/lib/api/categories.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
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

/**
 * A brand write, plus the optional logo file to upload with it. The file is kept separate from
 * `BrandInput` because it is not part of the record's shape — the backend replaces it with the
 * hosted URL that comes back on `Brand.logo`.
 */
export interface BrandMutationInput {
  input: BrandInput
  logoFile?: File | null
}

export interface BulkCreateBrandsResult {
  created: Array<{ id: string; name: string; slug: string }>
  skipped: Array<{ name: string; reason: string }>
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

/**
 * The backend's brand routes accept *either* a plain JSON body carrying a pre-hosted `logo` URL,
 * or a multipart body with the payload under `data` and the file in a `logo` field, which it
 * uploads and turns into that same URL. Only build multipart when a file was actually picked —
 * sending an empty file field makes the backend reject the request outright.
 */
function brandBody(input: BrandInput, logoFile?: File | null): BodyInit {
  if (!logoFile) return JSON.stringify(input)

  const form = new FormData()
  form.append('data', JSON.stringify(input))
  form.append('logo', logoFile)
  return form
}

async function createBrand({ input, logoFile }: BrandMutationInput): Promise<Brand> {
  const res = await request<Brand>('/brands', { method: 'POST', body: brandBody(input, logoFile) })
  return res.data
}

async function updateBrand(id: string, { input, logoFile }: BrandMutationInput): Promise<Brand> {
  const res = await request<Brand>(`/brands/${id}`, { method: 'PATCH', body: brandBody(input, logoFile) })
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
    mutationFn: ({ id, ...mutation }: { id: string } & BrandMutationInput) => updateBrand(id, mutation),
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
