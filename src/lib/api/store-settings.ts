/** Real backend store-setting calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * The storefront presentation blocks — `Json` columns on the backend, each with its own nested Zod
 * schema there.
 *
 * These used to be `unknown`, with a note saying typing them belonged with the editor that
 * eventually edits them. That editor is here: Header Links and Footer Links under UI. The shapes
 * below mirror the backend's `store-setting.validation.ts` — including its limits, which are
 * repeated as the constants beneath so the editors can enforce them before a save rather than
 * surfacing a 400 the merchant has to decode.
 */

export interface NavChild {
  label: string
  href: string
}

export interface NavItem extends NavChild {
  /**
   * One level only. The backend enforces this structurally — its child schema has no `children` key
   * and is `.strict()`, so a third level is a parse error rather than a silently dropped field.
   */
  children?: NavChild[]
}

/** See the backend's `announcementBarSchema`. */
export type AnnouncementLinkSource = 'contactPhone' | 'contactEmail'

export interface AnnouncementLink extends NavChild {
  /** An Iconify name, e.g. `akar-icons:whatsapp-fill`. */
  icon?: string
  /**
   * Binds the link to the store's contact details: with this set the storefront renders the label
   * and href from `contactPhone`/`contactEmail` instead of the stored literals, so the announcement
   * bar and the footer's contact block cannot drift apart.
   */
  source?: AnnouncementLinkSource
}

export interface AnnouncementBar {
  /** Separate from the content, so switching the bar off does not discard the text. */
  enabled: boolean
  text: string
  links?: AnnouncementLink[]
}

export interface FooterColumn {
  title: string
  /** Objects, never bare strings — a footer link without a target renders dead. */
  links: NavChild[]
}

/** Constrained to the platforms the storefront has an icon for. */
export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'x', 'pinterest'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface Newsletter {
  heading: string
  subtext: string
  placeholder?: string
  buttonLabel?: string
}

/* ------------------------------------------------------------------ *
 * Currency presentation
 * ------------------------------------------------------------------ */

/** Which side of the amount the symbol sits on. Mirrors the backend's `CurrencyPosition` enum. */
export const CURRENCY_POSITIONS = ['BEFORE', 'AFTER'] as const
export type CurrencyPosition = (typeof CURRENCY_POSITIONS)[number]

/**
 * What the storefront ROOT serves. Governs `/` and nothing else — every other
 * route stays live in both modes, which is what makes the toggle reversible
 * with no other consequence.
 */
export const SITE_MODES = ['WEBSITE', 'LANDING_PAGE'] as const
export type SiteMode = (typeof SITE_MODES)[number]

/**
 * Mirrors the backend's `MIN_CURRENCY_DECIMALS` / `MAX_CURRENCY_DECIMALS`.
 *
 * 0 covers currencies with no minor unit, 3 those with a thousandth unit, 4 is headroom. Repeated
 * here so the field can bound itself rather than surfacing a 400 the merchant has to decode — the
 * same arrangement as `SETTINGS_LIMITS` below.
 */
export const CURRENCY_DECIMALS_LIMITS = { min: 0, max: 4, default: 2 } as const

/** Mirrors the backend's `.max(...)` caps. A save past one of these is rejected there. */
export const SETTINGS_LIMITS = {
  mainNavItems: 20,
  navChildren: 20,
  footerColumns: 6,
  footerLinksPerColumn: 20,
  announcementLinks: 6,
  socialLinks: 10,
  checkoutNotice: 300,
} as const

/* ------------------------------------------------------------------ *
 * Checkout configuration
 * ------------------------------------------------------------------ */

/**
 * The six configurable checkout fields, in the order the admin table shows
 * them. These are the backend's own keys, which are in turn the order payload's
 * keys — so the table, the API and the storefront all name a field the same way.
 */
export const CHECKOUT_FIELD_KEYS = [
  'fullName',
  'phone',
  'addressLine1',
  'addressLine2',
  'city',
  'postalCode',
] as const

export type CheckoutFieldKey = (typeof CHECKOUT_FIELD_KEYS)[number]

/** Labels for the table's first column, matching the storefront's own wording. */
export const CHECKOUT_FIELD_LABELS: Record<CheckoutFieldKey, string> = {
  fullName: 'Customer name',
  phone: 'Mobile number',
  addressLine1: 'Address',
  addressLine2: 'Apartment, floor',
  city: 'City',
  postalCode: 'Postal code',
}

/**
 * Mobile number is not a merchant decision: guest order lookup and the per-phone
 * cash-on-delivery limit are both keyed on it. The backend refuses to save a
 * config that hides or relaxes it, so the table renders this row locked rather
 * than letting a merchant build a payload that will be rejected.
 */
export const LOCKED_CHECKOUT_FIELDS: CheckoutFieldKey[] = ['phone']

export interface CheckoutField {
  show: boolean
  required: boolean
}

/** Whether an option is delivered to the shopper or collected by them. */
export type DeliveryKind = 'DELIVERY' | 'PICKUP'

/**
 * One delivery choice offered at checkout.
 *
 * No country, no region, nothing matched against an address — the shopper picks
 * this from a list. `key` is generated once when the option is added and never
 * rewritten, so renaming an option does not re-bucket the orders placed under
 * it; `label` is what the shopper reads and what the order captures.
 */
export interface DeliveryOption {
  key: string
  label: string
  kind: DeliveryKind
  price: number
  days: number
}

export interface DeliverySettings {
  /** Off, pickup options are not offered even when some are configured. */
  offersPickup: boolean
  options: DeliveryOption[]
}

/** Mirrors the backend's bound, so the form can stop adding before the API refuses. */
export const MAX_DELIVERY_OPTIONS = 20

export interface CheckoutConfig {
  fields: Record<CheckoutFieldKey, CheckoutField>
  /** Governs the coupon box on the cart page AND the checkout page together. */
  showCouponBox: boolean
  showOrderNote: boolean
  allowGuestCheckout: boolean
  /** Rendered above the storefront's Place Order button. Empty renders nothing. */
  notice: string
  delivery: DeliverySettings
}

/* ------------------------------------------------------------------ *
 * Theme
 * ------------------------------------------------------------------ */

/** The full-width sentinel — `maxWidth` is either this or one of the widths below. */
export const FULL_WIDTH = 'full' as const

/**
 * The content widths a merchant may choose. Mirrors the backend's
 * `SITE_CONTENT_WIDTHS`, which rejects anything else.
 *
 * It is a closed set rather than the free pixel field this used to be because
 * the homepage hero is proportioned from it — see `hero-slots.ts`. Every hero
 * slot keeps its aspect ratio at each of these, so a merchant switching width
 * never has to re-cut their banners.
 */
export const SITE_CONTENT_WIDTHS = [
  { value: 1140, label: 'Narrow', hint: 'Tighter pages, closer to a blog' },
  { value: 1280, label: 'Compact', hint: 'Comfortable on a laptop screen' },
  { value: 1440, label: 'Standard', hint: 'The default' },
  { value: 1600, label: 'Wide', hint: 'More products per row on a large screen' },
] as const

export const DEFAULT_SITE_CONTENT_WIDTH = 1440

/**
 * The nearest offered width to a stored one. A store saved before the set
 * closed carries a width that is not in it — 1384 was the old default — and the
 * select has to show it as something, so it shows what the storefront will
 * actually render it at.
 */
export function nearestContentWidth(width: number): number {
  return SITE_CONTENT_WIDTHS.reduce((best, option) =>
    Math.abs(option.value - width) < Math.abs(best.value - width) ? option : best,
  ).value
}

/** The six colour tokens, with the labels and help text the form shows. */
export const THEME_COLOR_FIELDS = [
  { key: 'background', label: 'Page background', hint: 'The surface behind every page' },
  { key: 'foreground', label: 'Body text', hint: 'Default text colour' },
  { key: 'brand', label: 'Brand', hint: 'Buttons, links and active states' },
  { key: 'brandDark', label: 'Brand (dark)', hint: 'Hover and pressed states' },
  { key: 'accent', label: 'Accent', hint: 'Highlights and the wordmark accent' },
  { key: 'sale', label: 'Sale', hint: 'Prices and discount badges' },
] as const

export type ThemeColorKey = (typeof THEME_COLOR_FIELDS)[number]['key']

export interface ThemeFont {
  family: string
  /**
   * Always a `fonts.googleapis.com` URL the backend rebuilt from validated
   * parts. Sending this value straight back is a legitimate no-op update — it
   * re-parses to itself — which is how the form leaves an untouched font alone.
   */
  url: string
}

export interface Theme {
  background: string
  foreground: string
  brand: string
  brandDark: string
  accent: string
  sale: string
  maxWidth: number | typeof FULL_WIDTH
  font: ThemeFont
}

/**
 * What the PATCH accepts for `theme`. Identical to `Theme` except that `font` is
 * the text the merchant pasted — the backend parses it. A bare URL is one of the
 * accepted paste forms, so resending `theme.font.url` unchanged is valid.
 */
export type ThemeInput = Omit<Theme, 'font'> & { font: string }

export interface StoreSettings {
  id: string
  storeName: string
  currency: string
  currencySymbol: string
  currencyPosition: CurrencyPosition
  /** Presentation only — see `CURRENCY_DECIMALS_LIMITS`. */
  currencyDecimals: number
  /** Null means free shipping by order value is not offered at all, which is distinct from a 0 threshold. */
  freeShippingThreshold: number | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  logoUrl: string | null
  footerLogoUrl: string | null
  siteNameAccent: string | null
  aboutText: string | null
  copyrightText: string | null
  siteUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  maxPendingCodOrdersPerPhone: number
  maxGuestOrdersPerIpPerHour: number
  /**
   * Null when the column has never been written. The PUBLIC endpoint merges defaults over these,
   * but this is the ADMIN read, which deliberately returns the stored row as-is — an editor has to
   * be able to tell "not configured" from "configured to this", or it would present a default as
   * though the merchant had saved it.
   */
  mainNav: NavItem[] | null
  footerColumns: FooterColumn[] | null
  socialLinks: SocialLink[] | null
  announcementBar: AnnouncementBar | null
  newsletter: Newsletter | null
  /**
   * Null until a merchant saves the page. The two editors seed their forms from
   * the backend's own defaults in that case, so "never configured" and
   * "configured to the defaults" stay distinguishable in the stored row.
   */
  checkoutConfig: CheckoutConfig | null
  theme: Theme | null
  /**
   * The website ↔ single-landing-page toggle, and the page it points at.
   *
   * Only meaningful together. The backend refuses to enter `LANDING_PAGE`
   * unless `activeLandingPageId` resolves to a PUBLISHED landing page, and
   * refuses to clear the selection while the mode is on — both checked
   * transactionally, so this pair is never stored in an unservable state.
   */
  siteMode: SiteMode
  activeLandingPageId: string | null
  updatedAt: string
}

/**
 * Every field is optional because the backend validates it that way and applies the payload as a
 * partial upsert. A key left out is untouched — which is how the page avoids clobbering the
 * storefront JSON blocks it never shows.
 *
 * The backend rejects `null` for these (they are `.optional()`, not `.nullable()`), so "clear this
 * value" is expressed by omitting the key, never by sending null.
 */
export interface StoreSettingsInput {
  storeName?: string
  currency?: string
  currencySymbol?: string
  currencyPosition?: CurrencyPosition
  currencyDecimals?: number
  /**
   * The one `null`-accepting field here, and deliberately so. Everything else on this interface
   * expresses "clear this" by omitting the key, but this column has THREE states, not two: a
   * threshold, no offer at all (`null`), and an offer on every order (`0`). Under a partial upsert
   * an omitted key means "leave unchanged" — which is why a merchant who set a threshold could
   * previously never unset it.
   */
  freeShippingThreshold?: number | null
  contactEmail?: string
  contactPhone?: string
  address?: string
  logoUrl?: string
  footerLogoUrl?: string
  siteNameAccent?: string
  aboutText?: string
  copyrightText?: string

  siteUrl?: string
  metaTitle?: string
  metaDescription?: string

  /*
   * The storefront presentation blocks. Optional like everything else here, and that is what keeps
   * the editors that write to this endpoint from clobbering each other: the header editor sends
   * only `mainNav` + `announcementBar`, the footer editor sends only the rest, the checkout editor
   * sends only `checkoutConfig`, and Site Setting sends the branding scalars plus `theme`. A key
   * left out is untouched.
   */
  mainNav?: NavItem[]
  footerColumns?: FooterColumn[]
  socialLinks?: SocialLink[]
  announcementBar?: AnnouncementBar
  newsletter?: Newsletter

  checkoutConfig?: CheckoutConfig
  /** `font` goes up as pasted text; the backend parses it. See `ThemeInput`. */
  theme?: ThemeInput

  /**
   * The site-mode pair, sent only by the Landing Pages screen — which is the
   * one place both halves of the decision are visible at once.
   *
   * `activeLandingPageId` accepts `null` for the same reason
   * `freeShippingThreshold` above does: an omitted key means "leave unchanged"
   * under a partial upsert, so without null a merchant who selected a page
   * could never deselect it.
   */
  siteMode?: SiteMode
  activeLandingPageId?: string | null
}

/**
 * What the two new editors seed an unconfigured store's form with — the same
 * values the backend falls back to, so the form shows what the storefront is
 * actually doing rather than a blank slate.
 */
export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  fields: {
    fullName: { show: true, required: true },
    phone: { show: true, required: true },
    addressLine1: { show: true, required: true },
    addressLine2: { show: true, required: false },
    city: { show: true, required: true },
    postalCode: { show: true, required: false },
  },
  showCouponBox: true,
  showOrderNote: true,
  allowGuestCheckout: true,
  notice: '',
}

export const DEFAULT_THEME: Theme = {
  background: '#ffffff',
  foreground: '#1a1a1a',
  brand: '#0f63b3',
  brandDark: '#133f9e',
  accent: '#f5b301',
  sale: '#e02020',
  maxWidth: DEFAULT_SITE_CONTENT_WIDTH,
  font: {
    family: 'Outfit',
    url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap',
  },
}

async function getStoreSettings(): Promise<StoreSettings> {
  const res = await request<StoreSettings>('/settings')
  return res.data
}

async function updateStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
  const res = await request<StoreSettings>('/settings', { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

export function useStoreSettings() {
  return useQuery({ queryKey: queryKeys.storeSettings.detail, queryFn: getStoreSettings })
}

export function useUpdateStoreSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail }),
  })
}
