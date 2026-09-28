import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from './request'
import type { ListParams, PaginatedResponse } from './client'
import { queryKeys } from './query-keys'

export type LandingPageStatus = 'DRAFT' | 'PUBLISHED'

/** The statuses the form offers, in the order it offers them. */
export const LANDING_PAGE_STATUSES: LandingPageStatus[] = ['DRAFT', 'PUBLISHED']

/** One gallery entry. A landing page sells with pictures and a video, in order. */
export interface LandingPageMedia {
  type: 'IMAGE' | 'VIDEO'
  url: string
  /** Poster frame for a VIDEO; ignored for an IMAGE. */
  thumbnailUrl?: string
  alt?: string
}

/** A "কেন কিনবেন" bullet. `icon` is an Iconify name. */
export interface LandingPageHighlight {
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
  /**
   * Optional, because a review may be a SCREENSHOT instead. The backend rejects
   * a quote carrying neither text nor an image, so the form must require one of
   * the two rather than requiring this.
   */
  text?: string
  rating?: number
  /** The reviewer's own avatar. */
  photoUrl?: string
  /** The review itself as an image — a screenshot of the message they sent. */
  imageUrl?: string
}

export interface LandingPageTrustBadge {
  icon?: string
  label: string
}

/**
 * One tier the campaign offers.
 *
 * `key` is generated ONCE when the package is added and never rewritten: a
 * placed order records it, so reordering or renaming a package must not
 * reattach historical orders to a different tier.
 *
 * `price` is authored — the one price a landing page may write. The backend
 * charges exactly this, through a single resolver the page render, the quote
 * and the order all read.
 */
export interface LandingPagePackage {
  key: string
  label: string
  productId: string
  price: number
  /** Struck through beside the price. Must be ABOVE it, enforced server-side. */
  compareAtPrice?: number
  freeGiftText?: string
  badge?: string
  preselected?: boolean
}

export interface LandingPageWhyUs {
  title: string
  text?: string
}

export interface LandingPageUsageIdea {
  label: string
  /** An Iconify name, e.g. `lucide:gift`. */
  icon?: string
}

/**
 * The campaign's own look — every colour the page draws, as named tokens.
 *
 * Every value is a hex; anything else is refused server-side, because these
 * reach the page as CSS custom properties in an inline style attribute. Each is
 * optional and blank means "the default", never "transparent".
 */
export interface LandingPageTheme {
  /** The campaign's colour: buttons, badges, active states. */
  accent?: string
  /** A wash of it — band backgrounds and selected-card fills. */
  accentSoft?: string
  /** What is legible ON the accent, usually white. */
  accentContrast?: string
  /** The primary content background. */
  surface?: string
  /** The alternating band background. */
  surfaceAlt?: string
  /** Body and heading colour. */
  text?: string
  /** Secondary copy. One muted weight; a second is opacity on this. */
  textMuted?: string
  /** Every rule and card edge. */
  border?: string
  displayFont?: { family: string; url: string }
}

/** Mirrors the backend's bounds, so the form stops adding before the API refuses. */
export const MAX_PACKAGES = 6
export const MAX_WHY_US = 12
export const MAX_USAGE_IDEAS = 16

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

  /**
   * THE SHOP'S delivery options, served with the page — not the campaign's own.
   *
   * A campaign no longer authors delivery prices. The charge is derived from
   * the shopper's district against this list, so the same address costs the
   * same through the shop and through a campaign, and changing a price in
   * Checkout Setting changes it everywhere.
   */
  deliveryOptions: { key: string; label: string; price: number }[]
  orderForm: LandingPageOrderForm

  /*
   * Offer mechanics. All absent on a page configuring none, which behaves
   * exactly as landing pages did before they existed.
   */
  packages: LandingPagePackage[] | null
  whyUs: LandingPageWhyUs[] | null
  usageIdeas: LandingPageUsageIdea[] | null
  /** An ISO instant, never a duration — every visitor counts down to one moment. */
  offerEndsAt: string | null
  stopOrdersAtDeadline: boolean
  /**
   * The SIZE of a limited run. How many have been taken is counted by the
   * server from real orders — there is deliberately no field to seed it with.
   */
  scarcityTarget: number | null
  orderPhone: string | null
  /**
   * Whether this campaign collects money before it ships.
   *
   * Refused on save unless the shop has advance payment enabled with at least
   * one account — the form disables the switch for the same reason, so it
   * cannot express what the API will reject.
   */
  requiresAdvancePayment: boolean
  theme: LandingPageTheme | null

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

  /**
   * What each TIER produced. Present on the detail read only.
   *
   * Grouped by the key captured on the order, so a package the merchant has
   * since deleted still reports what it earned — which is exactly when this is
   * most wanted. Absent on the list, where it would cost a second grouped query
   * for a figure nobody reads until they open one campaign.
   */
  packageTotals?: {
    key: string | null
    label: string | null
    orderCount: number
    revenue: number
  }[]
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
  orderForm?: LandingPageOrderForm

  packages?: LandingPagePackage[]
  whyUs?: LandingPageWhyUs[]
  usageIdeas?: LandingPageUsageIdea[]
  offerEndsAt?: string
  stopOrdersAtDeadline?: boolean
  scarcityTarget?: number
  orderPhone?: string
  requiresAdvancePayment?: boolean
  theme?: LandingPageTheme

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
