import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export type BannerPosition = 'homepage_hero' | 'homepage_secondary' | 'category_top' | 'checkout_sidebar'

export interface Banner {
  id: string
  title: string
  imageUrl: string
  linkUrl: string
  position: BannerPosition
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface BannerInput {
  title: string
  imageUrl: string
  linkUrl: string
  position: BannerPosition
  sortOrder: number
  isActive: boolean
}

let banners: Banner[] = [
  { id: generateId('bnr'), title: 'Winter Clearance — Up to 40% Off', imageUrl: 'https://picsum.photos/seed/bnr1/960/320', linkUrl: '/campaigns/winter-clearance', position: 'homepage_hero', sortOrder: 1, isActive: true, createdAt: '2025-11-20T09:00:00Z' },
  { id: generateId('bnr'), title: 'New Arrivals: Aurora Ultrabooks', imageUrl: 'https://picsum.photos/seed/bnr2/960/320', linkUrl: '/catalog/laptops', position: 'homepage_secondary', sortOrder: 2, isActive: true, createdAt: '2025-12-01T09:00:00Z' },
  { id: generateId('bnr'), title: 'Free Shipping Over $50', imageUrl: 'https://picsum.photos/seed/bnr3/960/320', linkUrl: '/shipping-info', position: 'checkout_sidebar', sortOrder: 1, isActive: false, createdAt: '2025-12-05T09:00:00Z' },
]

async function listBanners(params: ListParams = {}): Promise<PaginatedResponse<Banner>> {
  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder)
  return delay(paginate(sorted, { ...params, limit: params.limit ?? 100 }))
}

async function createBanner(input: BannerInput): Promise<Banner> {
  const banner: Banner = { id: generateId('bnr'), createdAt: new Date().toISOString(), ...input }
  banners = [...banners, banner]
  recordAuditEntry({ action: 'banner.created', resourceType: 'banner', resourceId: banner.id, resourceLabel: banner.title })
  return delay(banner)
}

async function updateBanner(id: string, input: BannerInput): Promise<Banner> {
  const index = banners.findIndex((b) => b.id === id)
  if (index === -1) throw new ApiError('Banner not found', 404)
  const updated = { ...banners[index], ...input }
  banners = banners.map((b) => (b.id === id ? updated : b))
  recordAuditEntry({ action: 'banner.updated', resourceType: 'banner', resourceId: id, resourceLabel: updated.title })
  return delay(updated)
}

async function deleteBanner(id: string): Promise<void> {
  const target = banners.find((b) => b.id === id)
  banners = banners.filter((b) => b.id !== id)
  recordAuditEntry({ action: 'banner.deleted', resourceType: 'banner', resourceId: id, resourceLabel: target?.title })
  return delay(undefined)
}

async function reorderBanner(id: string, direction: 'up' | 'down'): Promise<Banner[]> {
  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder)
  const index = sorted.findIndex((b) => b.id === id)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= sorted.length) return delay(sorted)
  const a = sorted[index]
  const b = sorted[swapWith]
  const tmp = a.sortOrder
  a.sortOrder = b.sortOrder
  b.sortOrder = tmp
  banners = sorted
  return delay([...banners].sort((x, y) => x.sortOrder - y.sortOrder))
}

async function toggleBannerActive(id: string): Promise<Banner> {
  const index = banners.findIndex((b) => b.id === id)
  if (index === -1) throw new ApiError('Banner not found', 404)
  const updated = { ...banners[index], isActive: !banners[index].isActive }
  banners = banners.map((b) => (b.id === id ? updated : b))
  return delay(updated)
}

export function useBanners(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.banners.list(params), queryFn: () => listBanners(params) })
}

export function useCreateBanner() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createBanner, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }) })
}

export function useUpdateBanner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BannerInput }) => updateBanner(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }),
  })
}

export function useDeleteBanner() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteBanner, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }) })
}

export function useReorderBanner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => reorderBanner(id, direction),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }),
  })
}

export function useToggleBannerActive() {
  const client = useQueryClient()
  return useMutation({ mutationFn: toggleBannerActive, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }) })
}
