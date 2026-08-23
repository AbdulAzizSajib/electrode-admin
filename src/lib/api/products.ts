/** Real backend product calls — follows the same envelope/error pattern as `categories.ts`/`brands.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type ListParams, type PaginatedResponse, type PaginationMeta } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { Category } from '@/lib/api/categories'
import type { Brand } from '@/lib/api/brands'

export type ProductType = 'SIMPLE' | 'VARIABLE'
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface ProductImage {
  /** Present when this row came from the backend; omit for a newly-added row. */
  id?: string
  url: string
  altText?: string
  sortOrder: number
  isPrimary: boolean
}

export interface ProductVariant {
  /** Present when this row came from the backend; omit for a newly-added row. */
  id?: string
  name: string
  sku: string
  /** Decimal column — arrives as a string from the API (see design.md). */
  price?: string
  stockQuantity?: number
  attributes: Record<string, string>
}

/** Request-side counterpart of `ProductVariant` — `price` is a plain number here, not the string a Decimal column reads back as. */
export interface ProductVariantInput {
  id?: string
  name: string
  sku: string
  price: number
  stockQuantity: number
  attributes: Record<string, string>
}

export interface ProductAttribute {
  /** Present when this row came from the backend; omit for a newly-added row. */
  id?: string
  name: string
  value: string
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  description: string | null
  shortDescription: string | null
  type: ProductType
  status: ProductStatus
  categoryId: string | null
  brandId: string | null
  category: Category | null
  brand: Brand | null
  /** Decimal column — arrives as a string from the API (see design.md). */
  price: string
  /** Decimal column — arrives as a string from the API (see design.md). */
  compareAtPrice: string | null
  stockQuantity: number
  lowStockThreshold: number
  isFeatured: boolean
  /** List rows (`GET /products/admin`) only include the primary image; detail includes all. */
  images: ProductImage[]
  /** Present on detail responses (`GET /products/admin/:id`) only — list rows omit it. */
  variants?: ProductVariant[]
  /** Present on detail responses (`GET /products/admin/:id`) only — list rows omit it. */
  attributes?: ProductAttribute[]
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  sku?: string
  description?: string
  shortDescription?: string
  type?: ProductType
  status?: ProductStatus
  categoryId?: string
  brandId?: string
  price: number
  compareAtPrice?: number
  stockQuantity?: number
  lowStockThreshold?: number
  isFeatured?: boolean
  images?: ProductImage[]
  variants?: ProductVariantInput[]
  attributes?: ProductAttribute[]
}

export interface ProductListParams extends ListParams {
  categoryId?: string
  brandId?: string
  status?: ProductStatus
  type?: ProductType
  isFeatured?: boolean
}

export interface ProductListRow extends Product {
  stockStatus: StockStatus
}

function stockStatus(p: Pick<Product, 'stockQuantity' | 'lowStockThreshold'>): StockStatus {
  if (p.stockQuantity <= 0) return 'out_of_stock'
  if (p.stockQuantity <= p.lowStockThreshold) return 'low_stock'
  return 'in_stock'
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

async function listProducts(params: ProductListParams = {}): Promise<PaginatedResponse<ProductListRow>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.brandId) query.set('brandId', params.brandId)
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)
  if (params.isFeatured !== undefined) query.set('isFeatured', String(params.isFeatured))

  const res = await request<Product[]>(`/products/admin?${query}`)
  const rows = res.data.map((p) => ({ ...p, stockStatus: stockStatus(p) }))
  return {
    data: rows,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: rows.length, totalPages: 1 },
  }
}

async function getProduct(id: string): Promise<ProductListRow> {
  const res = await request<Product>(`/products/admin/${id}`)
  return { ...res.data, stockStatus: stockStatus(res.data) }
}

async function createProduct(input: ProductInput): Promise<Product> {
  const res = await request<Product>('/products', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const res = await request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteProduct(id: string): Promise<void> {
  await request<Product>(`/products/${id}`, { method: 'DELETE' })
}

export function useProducts(params: ProductListParams = {}) {
  return useQuery({ queryKey: queryKeys.products.list(params), queryFn: () => listProducts(params) })
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.products.detail(id ?? ''), queryFn: () => getProduct(id!), enabled: !!id })
}

export function useCreateProduct() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createProduct, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.products.all }) })
}

export function useUpdateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInput }) => updateProduct(id, input),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.products.all })
      client.invalidateQueries({ queryKey: queryKeys.products.detail(variables.id) })
    },
  })
}

export function useDeleteProduct() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteProduct, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.products.all }) })
}
