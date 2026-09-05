/** Real backend landing page calls — same envelope/error pattern as `pages.ts` and `testimonials.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const LANDING_PAGE_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type LandingPageStatus = (typeof LANDING_PAGE_STATUSES)[number]

/** Mirrors the backend's `MAX_DELIVERY_ZONES`. */
export const MAX_DELIVERY_ZONES = 5

export interface LandingPageMedia {
  type: 'IMAGE' | 'VIDEO'
  url: string
  /** Poster frame for a VIDEO; ignored for an IMAGE. */
  thumbnailUrl?: string
  alt?: string
}

export interface LandingPageHighlight {
  /** An Iconify name, e.g. `mdi:truck-fast`. */
  icon?: string
  title: string
  text?: string
}

export interface LandingPageFaq {
  question: string
  answer: string
}

export interface LandingPageQuote {
  name: string
  text: string
  rating?: number
  photoUrl?: string
}

export interface LandingPageTrustBadge {
  icon?: string
  label: string
}

/**
 * One delivery option the page offers — `ঢাকার ভিতরে ৳60` / `ঢাকার বাইরে ৳120`.
 *
 * `price` is what the shopper is CHARGED, not a display figure: the server
 * looks the zone up by `key` and charges its stored price, bypassing the
 * product's shipping rule entirely.
 */
export interface DeliveryZone {
  key: string
  label: string
  price: number
}

export interface LandingPageFormField {
  label: string
  placeholder?: string
  helper?: string
}

/**
 * The order form's authored copy.
 *
 * Only `fullName` has a `required` flag, and that is not an oversight: the
 * backend's schema is `.strict()`, so sending `required` or `show` on `phone`
 * or `address` is rejected as an unknown key. Phone is what the per-phone COD
 * cap and guest order lookup are keyed on; address is what a COD parcel is
 * delivered to. Neither can be turned off from anywhere.
 */
export interface LandingPageOrderForm {
  heading?: string
  subheading?: string
  fields: {
    fullName: LandingPageFormField & { required: boolean }
    phone: LandingPageFormField
    address: LandingPageFormField
  }
  submitLabel: string
  notice?: string
}

export interface LandingPage {
  id: string
  title: string
  slug: string
  status: LandingPageStatus
  productId: string
  /** Included on the list and the detail read, so a row can name what it sells. */
  product?: { id: string; name: string; slug: string }

  headline: string
  subheadline: string | null
  badgeText: string | null
  bodyHtml: string

  media: LandingPageMedia[] | null
  highlights: LandingPageHighlight[] | null
  faqs: LandingPageFaq[] | null
  quotes: LandingPageQuote[] | null
  trustBadges: LandingPageTrustBadge[] | null

  deliveryZones: DeliveryZone[]
  orderForm: LandingPageOrderForm

  successHeading: string | null
  successMessage: string | null

  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  facebookPixelId: string | null

  sortOrder: number
  createdAt: string
  updatedAt: string

  /**
   * What this campaign produced. Present on the LIST only — computed in one
   * grouped query over the page of rows, so a list of ten campaigns is not
   * eleven queries.
   *
   * Counts every order regardless of status: at the point a merchant is
   * comparing two campaigns, a cancelled order still says the ad worked.
   */
  orderCount?: number
  revenue?: number
}

export interface LandingPageInput {
  title: string
  /** Omitted means "derive it from the title, then the headline". */
  slug?: string
  status?: LandingPageStatus
  productId: string

  headline: string
  subheadline?: string
  badgeText?: string
  bodyHtml: string

  media?: LandingPageMedia[]
  highlights?: LandingPageHighlight[]
  faqs?: LandingPageFaq[]
  quotes?: LandingPageQuote[]
  trustBadges?: LandingPageTrustBadge[]

  /** Omitted on create means "use the Bangla seed defaults". */
  deliveryZones?: DeliveryZone[]
  orderForm?: LandingPageOrderForm

  successHeading?: string
  successMessage?: string

  metaTitle?: string
  metaDescription?: string
  ogImageUrl?: string
  /** Digits only. An empty string clears it. */
  facebookPixelId?: string

  sortOrder?: number
}

export interface LandingPageListParams extends ListParams {
  status?: LandingPageStatus
}

/** Id, title and slug of every published page — what the active-page selector offers. */
export interface LandingPageSummary {
  id: string
  title: string
  slug: string
}

async function listLandingPages(
  params: LandingPageListParams = {},
): Promise<PaginatedResponse<LandingPage>> {
  const limit = params.limit ?? 50

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<LandingPage[]>(`/landing-pages?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? {
      page: params.page ?? 1,
      limit,
      total: res.data.length,
      totalPages: 1,
    },
  }
}

async function getLandingPage(id: string): Promise<LandingPage> {
  const res = await request<LandingPage>(`/landing-pages/${id}`)
  return res.data
}

async function listPublishedLandingPages(): Promise<LandingPageSummary[]> {
  const res = await request<LandingPageSummary[]>('/landing-pages/published')
  return res.data
}

async function createLandingPage(input: LandingPageInput): Promise<LandingPage> {
  const res = await request<LandingPage>('/landing-pages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateLandingPage(
  id: string,
  input: Partial<LandingPageInput>,
): Promise<LandingPage> {
  const res = await request<LandingPage>(`/landing-pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

async function duplicateLandingPage(id: string): Promise<LandingPage> {
  const res = await request<LandingPage>(`/landing-pages/${id}/duplicate`, { method: 'POST' })
  return res.data
}

async function deleteLandingPage(id: string): Promise<void> {
  await request<LandingPage>(`/landing-pages/${id}`, { method: 'DELETE' })
}

export function useLandingPages(params: LandingPageListParams = {}) {
  return useQuery({
    queryKey: queryKeys.landingPages.list(params),
    queryFn: () => listLandingPages(params),
  })
}

export function useLandingPage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.landingPages.detail(id ?? ''),
    queryFn: () => getLandingPage(id!),
    enabled: !!id,
  })
}

export function usePublishedLandingPages() {
  return useQuery({
    queryKey: queryKeys.landingPages.published,
    queryFn: listPublishedLandingPages,
  })
}

export function useCreateLandingPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createLandingPage,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.landingPages.all }),
  })
}

/**
 * Invalidates the store settings alongside the landing pages.
 *
 * Publishing or unpublishing a page changes which pages the active-page
 * selector may offer AND whether the shop's current selection is still
 * servable, both of which the settings screen reads. Without this, unpublishing
 * the selected page would leave the site-mode banner still showing it as live.
 */
export function useUpdateLandingPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<LandingPageInput> }) =>
      updateLandingPage(id, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.landingPages.all })
      client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail })
    },
  })
}

export function useDuplicateLandingPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: duplicateLandingPage,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.landingPages.all }),
  })
}

export function useDeleteLandingPage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteLandingPage,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.landingPages.all })
      // Deleting the selected page nulls the settings pointer server-side.
      client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail })
    },
  })
}
