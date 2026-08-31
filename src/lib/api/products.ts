/** Real backend product calls — follows the same envelope/error pattern as `categories.ts`/`brands.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
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

/** Metadata for one locally-picked file, matched by position to `ProductImageUpload.files[i]` — see `createProduct`/`updateProduct`. */
export interface ImageSlotInput {
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
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

/**
 * Locally-picked image files to upload alongside `ProductInput.images` (which stays URL-only —
 * kept/new-by-URL entries). `files[i]`'s metadata is `imageSlots[i]`, matched by position — same
 * contract as the backend's `add-product-image-upload` change. Omit entirely (or pass an empty
 * `files` array) for a plain JSON request with no uploads.
 */
export interface ProductImageUpload {
  files: File[]
  imageSlots: ImageSlotInput[]
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

/**
 * Multipart helper kept as a thin wrapper over the shared `request`, which omits the JSON
 * `Content-Type` for `FormData` bodies so the browser can set the multipart boundary itself.
 */
function requestMultipart<T>(path: string, method: string, form: FormData) {
  return request<T>(path, { method, body: form })
}

/** Builds the `data` + repeated `images` multipart body the backend's product routes expect. */
function buildProductForm(input: ProductInput, upload: ProductImageUpload): FormData {
  const form = new FormData()
  form.append('data', JSON.stringify({ ...input, imageSlots: upload.imageSlots }))
  for (const file of upload.files) {
    form.append('images', file)
  }
  return form
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

async function createProduct(input: ProductInput, upload?: ProductImageUpload): Promise<Product> {
  const res =
    upload && upload.files.length > 0
      ? await requestMultipart<Product>('/products', 'POST', buildProductForm(input, upload))
      : await request<Product>('/products', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateProduct(id: string, input: ProductInput, upload?: ProductImageUpload): Promise<Product> {
  const res =
    upload && upload.files.length > 0
      ? await requestMultipart<Product>(`/products/${id}`, 'PATCH', buildProductForm(input, upload))
      : await request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

/**
 * Products referenced by orders or purchase orders are archived rather than
 * deleted server-side, so the response message is the only signal telling the
 * two outcomes apart. Return it for the caller to surface.
 */
async function deleteProduct(id: string): Promise<{ message: string }> {
  const res = await request<Product>(`/products/${id}`, { method: 'DELETE' })
  return { message: res.message }
}

export function useProducts(params: ProductListParams = {}) {
  return useQuery({ queryKey: queryKeys.products.list(params), queryFn: () => listProducts(params) })
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.products.detail(id ?? ''), queryFn: () => getProduct(id!), enabled: !!id })
}

export function useCreateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, upload }: { input: ProductInput; upload?: ProductImageUpload }) => createProduct(input, upload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.products.all }),
  })
}

export function useUpdateProduct() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input, upload }: { id: string; input: ProductInput; upload?: ProductImageUpload }) =>
      updateProduct(id, input, upload),
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
