import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { formatSlug } from '@/lib/utils/format'

/**
 * Local, product-mock-only category/brand references — both `categories.ts` and `brands.ts` now
 * talk to their real APIs and no longer expose a synchronous in-memory list, so this mock module
 * (still fully mock, unrelated to those changes) seeds its own fake products against these fixed
 * id/name lists instead of depending on either.
 */
const SEED_CATEGORIES = [
  { id: 'cat_seed_electronics', name: 'Electronics' },
  { id: 'cat_seed_home_kitchen', name: 'Home & Kitchen' },
  { id: 'cat_seed_fashion', name: 'Fashion' },
  { id: 'cat_seed_sports_outdoors', name: 'Sports & Outdoors' },
  { id: 'cat_seed_mobile_phones', name: 'Mobile Phones' },
  { id: 'cat_seed_laptops', name: 'Laptops' },
  { id: 'cat_seed_audio', name: 'Audio' },
  { id: 'cat_seed_cookware', name: 'Cookware' },
  { id: 'cat_seed_mens_clothing', name: "Men's Clothing" },
  { id: 'cat_seed_womens_clothing', name: "Women's Clothing" },
]

const SEED_BRANDS = [
  { id: 'brand_seed_aurora', name: 'Aurora' },
  { id: 'brand_seed_northline', name: 'Northline' },
  { id: 'brand_seed_verdant', name: 'Verdant' },
  { id: 'brand_seed_cadence', name: 'Cadence' },
  { id: 'brand_seed_formal_wear_co', name: 'Formal Wear Co.' },
]

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  sku: string
  price: number
  compareAtPrice?: number
  brandId: string
  categoryIds: string[]
  images: string[]
  isPublished: boolean
  stockQuantity: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  slug?: string
  description: string
  sku: string
  price: number
  compareAtPrice?: number
  brandId: string
  categoryIds: string[]
  images: string[]
  isPublished: boolean
  stockQuantity: number
  lowStockThreshold: number
}

export interface ProductListParams extends ListParams {
  categoryId?: string
  brandId?: string
  status?: 'published' | 'draft'
}

function stockStatus(p: Pick<Product, 'stockQuantity' | 'lowStockThreshold'>): StockStatus {
  if (p.stockQuantity <= 0) return 'out_of_stock'
  if (p.stockQuantity <= p.lowStockThreshold) return 'low_stock'
  return 'in_stock'
}

const brandNames = () => Object.fromEntries(SEED_BRANDS.map((b) => [b.id, b.name]))
const categoryNames = () => Object.fromEntries(SEED_CATEGORIES.map((c) => [c.id, c.name]))

function seedProducts(): Product[] {
  const brands = SEED_BRANDS
  const categories = SEED_CATEGORIES
  const image = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`

  const raw: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { name: string }> = [
    { name: 'Aurora Wireless Earbuds Pro', description: 'Active noise-cancelling earbuds with 30-hour battery life.', sku: 'AUR-EB-001', price: 129.99, compareAtPrice: 159.99, brandId: brands[3].id, categoryIds: [categories[6].id], images: [image('eb1')], isPublished: true, stockQuantity: 84, lowStockThreshold: 20 },
    { name: 'Aurora 13" Ultrabook', description: 'Lightweight ultrabook with 16GB RAM and 512GB SSD.', sku: 'AUR-LT-013', price: 1099, compareAtPrice: 1249, brandId: brands[0].id, categoryIds: [categories[5].id], images: [image('lt1')], isPublished: true, stockQuantity: 12, lowStockThreshold: 15 },
    { name: 'Aurora Smartphone X12', description: '6.5" OLED display, 128GB storage, triple camera.', sku: 'AUR-PH-X12', price: 799, brandId: brands[0].id, categoryIds: [categories[4].id], images: [image('ph1')], isPublished: true, stockQuantity: 5, lowStockThreshold: 10 },
    { name: 'Cadence Studio Headphones', description: 'Over-ear studio monitor headphones.', sku: 'CAD-HP-002', price: 249.5, brandId: brands[3].id, categoryIds: [categories[6].id], images: [image('hp1')], isPublished: true, stockQuantity: 46, lowStockThreshold: 15 },
    { name: 'Verdant Non-Stick Cookware Set (10pc)', description: '10-piece non-stick cookware set, dishwasher safe.', sku: 'VRD-CK-010', price: 189, compareAtPrice: 219, brandId: brands[2].id, categoryIds: [categories[7].id], images: [image('ck1')], isPublished: true, stockQuantity: 31, lowStockThreshold: 10 },
    { name: 'Verdant Cast Iron Skillet 12"', description: 'Pre-seasoned cast iron skillet.', sku: 'VRD-CK-012', price: 44.99, brandId: brands[2].id, categoryIds: [categories[7].id], images: [image('ck2')], isPublished: true, stockQuantity: 0, lowStockThreshold: 10 },
    { name: 'Northline Trail Running Shoes', description: 'Breathable trail running shoes with grip sole.', sku: 'NRT-SH-021', price: 89.99, brandId: brands[1].id, categoryIds: [categories[3].id], images: [image('sh1')], isPublished: true, stockQuantity: 58, lowStockThreshold: 20 },
    { name: 'Northline 40L Hiking Backpack', description: 'Weatherproof 40L backpack with hydration sleeve.', sku: 'NRT-BP-040', price: 119, brandId: brands[1].id, categoryIds: [categories[3].id], images: [image('bp1')], isPublished: true, stockQuantity: 8, lowStockThreshold: 12 },
    { name: "Formal Wear Co. Men's Slim Fit Blazer", description: 'Tailored slim-fit blazer, navy.', sku: 'FWC-BL-100', price: 159, brandId: brands[4].id, categoryIds: [categories[8].id], images: [image('bl1')], isPublished: false, stockQuantity: 22, lowStockThreshold: 10 },
    { name: "Formal Wear Co. Women's Silk Blouse", description: 'Silk blend blouse, available in 5 colors.', sku: 'FWC-BL-200', price: 79, brandId: brands[4].id, categoryIds: [categories[9].id], images: [image('bl2')], isPublished: true, stockQuantity: 40, lowStockThreshold: 15 },
    { name: 'Aurora 27" 4K Monitor', description: '27-inch 4K IPS monitor, 99% sRGB.', sku: 'AUR-MN-027', price: 349, brandId: brands[0].id, categoryIds: [categories[5].id], images: [image('mn1')], isPublished: true, stockQuantity: 17, lowStockThreshold: 10 },
    { name: 'Cadence Portable Bluetooth Speaker', description: 'Waterproof portable speaker, 12-hour battery.', sku: 'CAD-SP-003', price: 59.99, brandId: brands[3].id, categoryIds: [categories[6].id], images: [image('sp1')], isPublished: true, stockQuantity: 3, lowStockThreshold: 15 },
  ]

  return raw.map((p, i) => ({
    ...p,
    id: generateId('prod'),
    slug: formatSlug(p.name),
    createdAt: new Date(Date.now() - (raw.length - i) * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - (raw.length - i) * 43_200_000).toISOString(),
  }))
}

let products: Product[] = seedProducts()

export function _getAllProducts() {
  return products
}

export function _getProductById(id: string) {
  return products.find((p) => p.id === id)
}

export function _adjustProductStock(id: string, delta: number) {
  products = products.map((p) => (p.id === id ? { ...p, stockQuantity: Math.max(0, p.stockQuantity + delta) } : p))
}

export interface ProductListRow extends Product {
  brandName: string
  categoryNames: string[]
  stockStatus: StockStatus
}

async function listProducts(params: ProductListParams = {}): Promise<PaginatedResponse<ProductListRow>> {
  const bNames = brandNames()
  const cNames = categoryNames()

  let filtered = products.filter((p) => matchesSearch([p.name, p.sku], params.search))
  if (params.categoryId) filtered = filtered.filter((p) => p.categoryIds.includes(params.categoryId!))
  if (params.brandId) filtered = filtered.filter((p) => p.brandId === params.brandId)
  if (params.status) filtered = filtered.filter((p) => (params.status === 'published' ? p.isPublished : !p.isPublished))

  const rows: ProductListRow[] = filtered.map((p) => ({
    ...p,
    brandName: bNames[p.brandId] ?? 'Unknown',
    categoryNames: p.categoryIds.map((id) => cNames[id]).filter(Boolean),
    stockStatus: stockStatus(p),
  }))

  return delay(paginate(rows, params))
}

async function getProduct(id: string): Promise<ProductListRow> {
  const found = products.find((p) => p.id === id)
  if (!found) throw new ApiError('Product not found', 404)
  const bNames = brandNames()
  const cNames = categoryNames()
  return delay({
    ...found,
    brandName: bNames[found.brandId] ?? 'Unknown',
    categoryNames: found.categoryIds.map((id) => cNames[id]).filter(Boolean),
    stockStatus: stockStatus(found),
  })
}

async function createProduct(input: ProductInput): Promise<Product> {
  if (input.price < 0) throw new ApiError('Price cannot be negative.', 422)
  const now = new Date().toISOString()
  const product: Product = {
    id: generateId('prod'),
    slug: input.slug?.trim() ? formatSlug(input.slug) : formatSlug(input.name),
    createdAt: now,
    updatedAt: now,
    ...input,
  }
  products = [product, ...products]
  recordAuditEntry({ action: 'product.created', resourceType: 'product', resourceId: product.id, resourceLabel: product.name })
  return delay(product)
}

async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const index = products.findIndex((p) => p.id === id)
  if (index === -1) throw new ApiError('Product not found', 404)
  if (input.price < 0) throw new ApiError('Price cannot be negative.', 422)
  const updated: Product = {
    ...products[index],
    ...input,
    slug: input.slug?.trim() ? formatSlug(input.slug) : products[index].slug,
    updatedAt: new Date().toISOString(),
  }
  products = products.map((p) => (p.id === id ? updated : p))
  recordAuditEntry({ action: 'product.updated', resourceType: 'product', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteProduct(id: string): Promise<void> {
  const target = products.find((p) => p.id === id)
  products = products.filter((p) => p.id !== id)
  recordAuditEntry({ action: 'product.deleted', resourceType: 'product', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

async function toggleProductCategory(productId: string, categoryId: string): Promise<Product> {
  const index = products.findIndex((p) => p.id === productId)
  if (index === -1) throw new ApiError('Product not found', 404)
  const product = products[index]
  const has = product.categoryIds.includes(categoryId)
  const updated: Product = {
    ...product,
    categoryIds: has ? product.categoryIds.filter((id) => id !== categoryId) : [...product.categoryIds, categoryId],
    updatedAt: new Date().toISOString(),
  }
  products = products.map((p) => (p.id === productId ? updated : p))
  return delay(updated)
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

export function useToggleProductCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, categoryId }: { productId: string; categoryId: string }) =>
      toggleProductCategory(productId, categoryId),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.products.detail(variables.productId) })
    },
  })
}
