/** Real backend product calls — follows the same envelope/error pattern as `categories.ts`/`brands.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Category } from '@/lib/api/categories'
import type { Brand } from '@/lib/api/brands'
import type { TaxRule } from '@/lib/api/tax-rules'
import type { BundleDeal } from '@/lib/api/bundle-deals'
import type { Collection } from '@/lib/api/collections'

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
  /** Backend variant id this image is assigned to, or null/undefined when shared across all variants. */
  variantId?: string | null
}

/** How an attribute's values are drawn on the storefront. */
export type OptionPresentation = 'SWATCH' | 'LABEL'

export interface ProductOptionValue {
  id: string
  label: string
  position: number
  swatch?: string | null
}

/**
 * An option a product presents, as it comes back from the API.
 *
 * **Derived, not stored.** A product no longer owns its options — it sells
 * values of shop-wide attributes, and the backend rebuilds this list from the
 * attributes its variants' values belong to (`deriveProductOptions`). `id` is
 * therefore the *attribute's* id, and `values` holds only the values this
 * product actually sells, not every value the attribute defines.
 */
export interface ProductOption {
  id: string
  name: string
  position: number
  presentation: OptionPresentation
  values: ProductOptionValue[]
}

/**
 * Request-side option: which shop-wide attribute this product sells, and which
 * of its values.
 *
 * The product does not define the attribute, so nothing here creates one — the
 * backend checks that every value named really belongs to the attribute named.
 * `valueIds` order is the order the values are presented in, and is also what
 * `ProductVariantInput.optionValueIndexes` indexes into.
 */
export interface ProductOptionInput {
  attributeId: string
  valueIds: string[]
  /** For error messages only; the attribute's own name is authoritative. */
  name?: string
}

export interface ProductVariant {
  /** Present when this row came from the backend; omit for a newly-added row. */
  id?: string
  name: string
  sku: string
  /** Decimal column — arrives as a string from the API (see design.md). */
  offerPrice?: string
  sellingPrice?: string | null
  stockQuantity?: number
  attributes: Record<string, string>
  image?: string | null
  /** Which attribute values define this variant. Empty for a product with no options. */
  optionValues?: { valueId: string }[]
}

/** Request-side counterpart of `ProductVariant` — the prices are plain numbers here, not the strings a Decimal column reads back as. */
export interface ProductVariantInput {
  id?: string
  name: string
  sku: string
  offerPrice: number
  sellingPrice?: number
  /*
   * No `stockQuantity`. The Stock ledger owns it and the backend rejects it
   * here — a variant's stock moves only via a StockMovement.
   */
  attributes: Record<string, string>
  /**
   * One index per option, into that option's `valueIds`. Positional because on
   * create no value selection has been persisted yet. Omitted for a product
   * with no options.
   */
  optionValueIndexes?: number[]
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
  /** What the shopper is charged. Decimal column — arrives as a string from the API (see design.md). */
  offerPrice: string
  /** The regular price, shown struck through. Null when nothing is on offer. */
  sellingPrice: string | null
  /**
   * Supplier cost. Optional because only ADMIN reads carry it — the public
   * product projections exclude it deliberately, so a response shaped by them
   * has no such key at all.
   */
  purchasePrice?: string | null
  stockQuantity: number
  lowStockThreshold: number
  isFeatured: boolean
  /**
   * Lifetime product-page views, deduplicated per viewer. A lifetime total, not
   * a live figure. Optional so a console running ahead of the backend still
   * renders; the column shows 0 in that case.
   */
  viewCount?: number
  /** List rows (`GET /products/admin`) only include the primary image; detail includes all. */
  images: ProductImage[]
  /** Present on detail responses (`GET /products/admin/:id`) only — list rows omit it. */
  options?: ProductOption[]
  /** Present on detail responses (`GET /products/admin/:id`) only — list rows omit it. */
  variants?: ProductVariant[]
  /** Present on detail responses (`GET /products/admin/:id`) only — list rows omit it. */
  attributes?: ProductAttribute[]

  /*
   * The named rule pricing this product's tax. Nullable in the schema because
   * rows predate the column, but the service treats a product without one as
   * incomplete — it cannot be taxed.
   *
   * There is no delivery counterpart any more. Delivery is a store-wide list the
   * shopper picks from at checkout, configured in Checkout Settings, so it is
   * not a property of a product at all.
   */
  taxRuleId: string | null
  taxRule?: TaxRule | null
  /** Optional: a product is perfectly sellable with no offer. */
  bundleDealId: string | null
  bundleDeal?: BundleDeal | null

  /** What it is sold in — "1 kg", "500 ml", "pack of 12". */
  unit: string | null
  /** A short storefront label — "New", "Hot". Presentation only. */
  badge: string | null
  /**
   * Tri-state. `null` means the merchant has not said, which the storefront
   * shows as nothing at all — a different claim from "No".
   */
  isRefundable: boolean | null
  hasWarranty: boolean | null

  video: string | null
  videoThumbnail: string | null

  /** Join rows, as the detail response nests them. */
  collections?: { collection: Collection }[]
  tags?: { tag: { id: string; name: string } }[]

  createdAt: string
  updatedAt: string
}

/** Metadata for one locally-picked file, matched by position to `ProductImageUpload.files[i]` — see `createProduct`/`updateProduct`. */
export interface ImageSlotInput {
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
  /** Backend variant id this uploaded image is assigned to. `variantId` wins over `variantIndex` when both are present. */
  variantId?: string
  /** Position in the same request's `variants` array, for variants created in this submission. Absence of both means shared. */
  variantIndex?: number
}

/** Request-side counterpart of `ProductImage` — carries the variant assignment fields the API accepts. */
export interface ProductImageInput {
  id?: string
  url: string
  altText?: string
  sortOrder: number
  isPrimary: boolean
  /** Backend variant id this image is assigned to. `variantId` wins over `variantIndex` when both are present. */
  variantId?: string | null
  /** Position in the same request's `variants` array, for variants created in this submission. Absence of both means shared. */
  variantIndex?: number
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
  /** What the shopper is charged — the only price a product must have. */
  offerPrice: number
  /** The regular price, struck through. Omitted when nothing is on offer. */
  sellingPrice?: number
  /** Supplier cost. Admin-only — the storefront never receives it. */
  purchasePrice?: number
  /** No `stockQuantity` — see `ProductVariantInput` above. */
  lowStockThreshold?: number
  isFeatured?: boolean

  taxRuleId?: string
  /** `null` clears the offer; omitting the key leaves it as it was. */
  bundleDealId?: string | null

  unit?: string
  badge?: string
  /** `null` is "not said", which is not the same as `false`. */
  isRefundable?: boolean | null
  hasWarranty?: boolean | null

  video?: string | null
  videoThumbnail?: string | null

  /** The full intended set of memberships — omitting the key leaves them alone. */
  collectionIds?: string[]
  /** Keyword names, created on demand. The full intended set. */
  tags?: string[]

  images?: ProductImageInput[]
  options?: ProductOptionInput[]
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

/**
 * One row of `GET /products/admin`, which is a deliberately narrow projection
 * rather than a whole `Product` — see `ADMIN_PRODUCT_LIST_SELECT` on the
 * server. Spelled out here so the table cannot quietly start reading a field
 * the response no longer carries: that would compile against `Product` and
 * render `undefined` at runtime.
 */
export interface ProductListItem {
  id: string
  name: string
  /** Supplier cost. Decimal, so a string. Null until the merchant records one. */
  purchasePrice: string | null
  /** What the shopper is charged. Decimal column — arrives as a string. */
  offerPrice: string
  /** The regular price, shown struck through. Decimal column — arrives as a string. */
  sellingPrice: string | null
  stockQuantity: number
  lowStockThreshold: number
  createdAt: string
  /**
   * The category the product is assigned to, plus its parent when it has one.
   *
   * A sub-category is not a separate model — the hierarchy lives on
   * `Category.parentId` — so this one relation answers both columns: with a
   * parent, `parent` is the category and this is the sub-category; without
   * one, this is the category and there is no sub-category.
   */
  category: { id: string; name: string; parent: { id: string; name: string } | null } | null
  brand: { id: string; name: string } | null
  taxRule: { id: string; name: string } | null
  /** At most one — the primary image, or the first authored one if none is marked primary. */
  images: { url: string }[]
}

export interface ProductListRow extends ProductListItem {
  stockStatus: StockStatus
}

/** A detail response (`GET /products/admin/:id`), which does return the whole product. */
export interface ProductDetailRow extends Product {
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
  if (params.sortBy) {
    query.set('sortBy', params.sortBy)
    query.set('sortOrder', params.sortOrder ?? 'desc')
  }

  const res = await request<ProductListItem[]>(`/products/admin?${query}`)
  const rows = res.data.map((p) => ({ ...p, stockStatus: stockStatus(p) }))
  return {
    data: rows,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: rows.length, totalPages: 1 },
  }
}

async function getProduct(id: string): Promise<ProductDetailRow> {
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

/**
 * `refetchOnWindowFocus` is off here despite being on globally (see `query-client.ts`).
 *
 * The edit form syncs its inventory half — images, combination rows, video — out of this query
 * whenever `updatedAt` changes, overwriting whatever is in the form. A refetch triggered by the
 * merchant tabbing away to a file picker or an image host and back would therefore discard their
 * unsaved edits mid-session. The list stays focus-refreshed; only the detail a form writes over
 * opts out.
 */
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: () => getProduct(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
  })
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
