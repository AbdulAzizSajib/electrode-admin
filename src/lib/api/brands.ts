import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { formatSlug } from '@/lib/utils/format'

export interface Brand {
  id: string
  name: string
  slug: string
  logoUrl?: string
  description?: string
  createdAt: string
}

export interface BrandInput {
  name: string
  slug?: string
  logoUrl?: string
  description?: string
}

let brands: Brand[] = [
  { id: generateId('brand'), name: 'Aurora', slug: 'aurora', description: 'Premium consumer electronics.', createdAt: '2025-10-15T09:00:00Z' },
  { id: generateId('brand'), name: 'Northline', slug: 'northline', description: 'Outdoor & sports gear.', createdAt: '2025-10-15T09:00:00Z' },
  { id: generateId('brand'), name: 'Verdant', slug: 'verdant', description: 'Home & kitchen essentials.', createdAt: '2025-10-16T09:00:00Z' },
  { id: generateId('brand'), name: 'Cadence', slug: 'cadence', description: 'Audio equipment.', createdAt: '2025-10-16T09:00:00Z' },
  { id: generateId('brand'), name: 'Formal Wear Co.', slug: 'formal-wear-co', description: 'Apparel and accessories.', createdAt: '2025-10-17T09:00:00Z' },
]

export function _getAllBrands() {
  return brands
}

async function listBrands(params: ListParams = {}): Promise<PaginatedResponse<Brand>> {
  const filtered = brands.filter((b) => matchesSearch([b.name, b.slug], params.search))
  return delay(paginate(filtered, params))
}

async function getBrand(id: string): Promise<Brand> {
  const found = brands.find((b) => b.id === id)
  if (!found) throw new ApiError('Brand not found', 404)
  return delay(found)
}

function slugTaken(slug: string, excludeId?: string) {
  return brands.some((b) => b.slug === slug && b.id !== excludeId)
}

async function createBrand(input: BrandInput): Promise<Brand> {
  const slug = input.slug?.trim() ? formatSlug(input.slug) : formatSlug(input.name)
  if (slugTaken(slug)) throw new ApiError('A brand with this slug already exists.', 409)
  const brand: Brand = { id: generateId('brand'), name: input.name, slug, logoUrl: input.logoUrl, description: input.description, createdAt: new Date().toISOString() }
  brands = [brand, ...brands]
  recordAuditEntry({ action: 'brand.created', resourceType: 'brand', resourceId: brand.id, resourceLabel: brand.name })
  return delay(brand)
}

async function updateBrand(id: string, input: BrandInput): Promise<Brand> {
  const index = brands.findIndex((b) => b.id === id)
  if (index === -1) throw new ApiError('Brand not found', 404)
  const slug = input.slug?.trim() ? formatSlug(input.slug) : brands[index].slug
  if (slugTaken(slug, id)) throw new ApiError('A brand with this slug already exists.', 409)
  const updated: Brand = { ...brands[index], name: input.name, slug, logoUrl: input.logoUrl, description: input.description }
  brands = brands.map((b) => (b.id === id ? updated : b))
  recordAuditEntry({ action: 'brand.updated', resourceType: 'brand', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteBrand(id: string): Promise<void> {
  const target = brands.find((b) => b.id === id)
  brands = brands.filter((b) => b.id !== id)
  recordAuditEntry({ action: 'brand.deleted', resourceType: 'brand', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

export function useBrands(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.brands.list(params), queryFn: () => listBrands(params) })
}

export function useBrand(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.brands.detail(id ?? ''), queryFn: () => getBrand(id!), enabled: !!id })
}

export function useCreateBrand() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createBrand, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }) })
}

export function useUpdateBrand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrandInput }) => updateBrand(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }),
  })
}

export function useDeleteBrand() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteBrand, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.brands.all }) })
}
