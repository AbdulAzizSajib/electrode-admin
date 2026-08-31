/** Real backend banner calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * Enum values are declared as `const` arrays and the TS unions derived from them, so the option
 * lists the UI renders and the types it checks against cannot drift apart. A stale string literal
 * would otherwise typecheck fine and simply match nothing at runtime.
 */
export const BANNER_PLACEMENTS = [
  'HEADER',
  'MID',
  'FOOTER',
  'SIDEBAR',
  'POPUP',
  'HERO_SLIDER',
  'HERO_SIDE',
  'HERO_PROMO',
] as const
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]

export const BANNER_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'SCHEDULED'] as const
export type BannerStatus = (typeof BANNER_STATUSES)[number]

/** IMAGE is artwork-only; DYNAMIC draws text/price/button over a background. */
export const BANNER_TYPES = ['IMAGE', 'DYNAMIC'] as const
export type BannerType = (typeof BANNER_TYPES)[number]

/**
 * Fields the backend renders only for a DYNAMIC banner. It *rejects* an IMAGE banner that carries
 * any of them rather than storing content nothing would draw, so the form must strip them when the
 * type is IMAGE — see `toBannerPayload`.
 */
export const DYNAMIC_ONLY_FIELDS = [
  'title',
  'subtitle',
  'description',
  'price',
  'discountPrice',
  'buttonText',
  'bgColor',
  'textColor',
] as const

export interface Banner {
  id: string
  type: BannerType
  placement: BannerPlacement
  image: string | null
  mobileImage: string | null
  title: string | null
  subtitle: string | null
  description: string | null
  price: string | null
  discountPrice: string | null
  buttonText: string | null
  bgColor: string | null
  textColor: string | null
  link: string | null
  productId: string | null
  status: BannerStatus
  sortOrder: number
  /** Null on either side means that end of the schedule is open — not "now". */
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BannerInput {
  type: BannerType
  placement: BannerPlacement
  image?: string
  mobileImage?: string
  title?: string
  subtitle?: string
  description?: string
  price?: number
  discountPrice?: number
  buttonText?: string
  bgColor?: string
  textColor?: string
  link?: string
  productId?: string
  status?: BannerStatus
  sortOrder?: number
  startsAt?: string
  endsAt?: string
}

/** A banner write plus the optional artwork files to upload with it. */
export interface BannerMutationInput {
  input: BannerInput
  imageFile?: File | null
  mobileImageFile?: File | null
}

export interface BannerListParams extends ListParams {
  status?: BannerStatus
  type?: BannerType
  placement?: BannerPlacement
}

/**
 * Multipart when artwork is attached, plain JSON otherwise — the backend's banner routes accept
 * either, with the non-file payload riding along under `data`.
 */
function bannerBody(input: BannerInput, imageFile?: File | null, mobileImageFile?: File | null): BodyInit {
  if (!imageFile && !mobileImageFile) return JSON.stringify(input)

  const form = new FormData()
  form.append('data', JSON.stringify(input))
  if (imageFile) form.append('image', imageFile)
  if (mobileImageFile) form.append('mobileImage', mobileImageFile)
  return form
}

async function listBanners(params: BannerListParams = {}): Promise<PaginatedResponse<Banner>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)
  if (params.type) query.set('type', params.type)
  if (params.placement) query.set('placement', params.placement)

  const res = await request<Banner[]>(`/banners/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getBanner(id: string): Promise<Banner> {
  const res = await request<Banner>(`/banners/admin/${id}`)
  return res.data
}

async function createBanner({ input, imageFile, mobileImageFile }: BannerMutationInput): Promise<Banner> {
  const res = await request<Banner>('/banners', {
    method: 'POST',
    body: bannerBody(input, imageFile, mobileImageFile),
  })
  return res.data
}

async function updateBanner(id: string, { input, imageFile, mobileImageFile }: BannerMutationInput): Promise<Banner> {
  const res = await request<Banner>(`/banners/${id}`, {
    method: 'PATCH',
    body: bannerBody(input, imageFile, mobileImageFile),
  })
  return res.data
}

async function deleteBanner(id: string): Promise<void> {
  await request<Banner>(`/banners/${id}`, { method: 'DELETE' })
}

export function useBanners(params: BannerListParams = {}) {
  return useQuery({ queryKey: queryKeys.banners.list(params), queryFn: () => listBanners(params) })
}

export function useBanner(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.banners.detail(id ?? ''), queryFn: () => getBanner(id!), enabled: !!id })
}

export function useCreateBanner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createBanner,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }),
  })
}

export function useUpdateBanner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...mutation }: { id: string } & BannerMutationInput) => updateBanner(id, mutation),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }),
  })
}

export function useDeleteBanner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.banners.all }),
  })
}
