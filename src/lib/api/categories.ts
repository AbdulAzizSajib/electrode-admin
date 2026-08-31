/**
 * Real backend category calls — unlike most other `src/lib/api/*` modules (still
 * mock-data, see client.ts), this one talks to the live Express API directly.
 * Follows the same envelope/error pattern as `src/lib/api/auth.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
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

/**
 * A category write, plus the optional artwork files to upload with it. Files are kept separate
 * from `CategoryInput` because they are not part of the record's shape — the backend replaces
 * them with the hosted URLs that come back on `Category.image` / `Category.banner`.
 */
export interface CategoryMutationInput {
  input: CategoryInput
  imageFile?: File | null
  bannerFile?: File | null
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

/**
 * The backend's category routes accept *either* a plain JSON body carrying pre-hosted `image`
 * URLs, or a multipart body with the payload under `data` and files in `image`/`banner` fields,
 * which it uploads and turns into those same URLs. Only build multipart when at least one file
 * was actually picked — an empty file field makes the backend reject the request outright.
 */
function categoryBody(input: CategoryInput, imageFile?: File | null, bannerFile?: File | null): BodyInit {
  if (!imageFile && !bannerFile) return JSON.stringify(input)

  const form = new FormData()
  form.append('data', JSON.stringify(input))
  if (imageFile) form.append('image', imageFile)
  if (bannerFile) form.append('banner', bannerFile)
  return form
}

async function createCategory({ input, imageFile, bannerFile }: CategoryMutationInput): Promise<Category> {
  const res = await request<Category>('/categories', {
    method: 'POST',
    body: categoryBody(input, imageFile, bannerFile),
  })
  return res.data
}

async function updateCategory(id: string, { input, imageFile, bannerFile }: CategoryMutationInput): Promise<Category> {
  const res = await request<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: categoryBody(input, imageFile, bannerFile),
  })
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
    mutationFn: ({ id, ...mutation }: { id: string } & CategoryMutationInput) => updateCategory(id, mutation),
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
