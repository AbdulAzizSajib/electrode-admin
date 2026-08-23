/**
 * Real backend category calls — unlike most other `src/lib/api/*` modules (still
 * mock-data, see client.ts), this one talks to the live Express API directly.
 * Follows the same envelope/error pattern as `src/lib/api/auth.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type ListParams, type PaginatedResponse, type PaginationMeta } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  banner: string | null
  status: boolean
  parentId: string | null
  seoTitle: string | null
  seoDescription: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** Present on detail responses (`GET /categories/admin/:id`) only. */
  parent?: Category | null
  /** Present on detail responses (`GET /categories/admin/:id`) only. */
  children?: Category[]
}

export interface CategoryInput {
  name: string
  description?: string
  image?: string
  status?: boolean
  sortOrder?: number
  /** Omit entirely for a top-level category — the backend rejects `null` here, it wants the key left out. */
  parentId?: string
}

export interface CategoryListParams extends ListParams {
  status?: boolean
  parentId?: string
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

async function listCategories(params: CategoryListParams = {}): Promise<PaginatedResponse<Category>> {
  const limit = params.limit ?? 100

  // Only add query params that actually have a value.
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status !== undefined) query.set('status', String(params.status))
  if (params.parentId) query.set('parentId', params.parentId)

  const res = await request<Category[]>(`/categories/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getCategory(id: string): Promise<Category> {
  const res = await request<Category>(`/categories/admin/${id}`)
  return res.data
}

/** Full hierarchy (any status, unlimited depth) with `children` nested at every level. */
async function getCategoryTree(): Promise<Category[]> {
  const res = await request<Category[]>('/categories/admin/tree')
  return res.data
}

async function createCategory(input: CategoryInput): Promise<Category> {
  const res = await request<Category>('/categories', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const res = await request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteCategory(id: string): Promise<void> {
  await request<Category>(`/categories/${id}`, { method: 'DELETE' })
}

export function useCategories(params: CategoryListParams = {}) {
  return useQuery({ queryKey: queryKeys.categories.list(params), queryFn: () => listCategories(params) })
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.categories.detail(id ?? ''),
    queryFn: () => getCategory(id!),
    enabled: !!id,
  })
}

/** Full category hierarchy, nested via `children` — use for tree views/pickers, not the flat table. */
export function useCategoryTree() {
  return useQuery({ queryKey: queryKeys.categories.tree, queryFn: getCategoryTree })
}

export function useCreateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.categories.all }),
  })
}

export function useUpdateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => updateCategory(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.categories.all }),
  })
}

export function useDeleteCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.categories.all }),
  })
}
