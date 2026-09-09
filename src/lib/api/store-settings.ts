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
 * Which courier the shop dispatches through.
 *
 * Mirrors the backend's `CourierProvider` enum and must be kept in step with
 * it — a provider registered there but missing here is unselectable in the
 * panel. The server is the authority on what each one can DO; this list is only
 * what may be chosen.
 *
 * `MANUAL` is a real selection meaning "our courier has no integration here",
 * not the absence of one. See openspec/changes/add-courier-provider-selection.
 */
export const COURIER_PROVIDERS = ['STEADFAST', 'MANUAL'] as const
export type CourierProvider = (typeof COURIER_PROVIDERS)[number]

/**
 * What an unconfigured shop's courier form shows.
 *
 * Mirrors the column default, so the form displays what the backend is actually
 * doing rather than a blank control — the same arrangement as
 * `DEFAULT_CHECKOUT_CONFIG` below.
 */
export const DEFAULT_COURIER_SETTINGS = { courierProvider: 'STEADFAST' as CourierProvider }

/**
 * Mirrors the backend's `MIN_CURRENCY_DECIMALS` / `MAX_CURRENCY_DECIMALS`.
 *
 * 0 covers currencies with no minor unit, 3 those with a thousandth unit, 4 is headroom. Repeated
 * here so the field can bound itself rather than surfacing a 400 the merchant has to decode — the
 * same arrangement as `SETTINGS_LIMITS` below.
 */
export const CURRENCY_DECIMALS_LIMITS = { min: 0, max: 4, default: 2 } as const

/** How a brand slot presents the shop. Mirrors the backend's `BrandDisplayMode`. */
export type BrandDisplayMode = 'TEXT' | 'LOGO'

/**
 * Mirrors the backend's `MIN_LOGO_HEIGHT` / `MAX_LOGO_HEIGHT` and the column
 * defaults, so the height inputs can bound themselves rather than surfacing a
 * 400 the merchant has to decode — the same arrangement as
 * `CURRENCY_DECIMALS_LIMITS` above. Keep in step with
 * store-setting.validation.ts.
 */
export const LOGO_HEIGHT_LIMITS = {
  min: 24,
  max: 96,
  headerDefault: 40,
  footerDefault: 36,
} as const

/**
 * What a store that has never chosen a mode is showing.
 *
 * TEXT for both, mirroring the column defaults. The admin read returns the row
 * as-is rather than merging defaults in — unlike the public endpoint — so
 * without this the editor could not tell "never configured" from "configured to
 * the default", which is the same reason every other settings editor here keeps
 * a mirrored `DEFAULT_*`.
 */
export const DEFAULT_BRAND_DISPLAY = {
  headerBrandMode: 'TEXT' as BrandDisplayMode,
  footerBrandMode: 'TEXT' as BrandDisplayMode,
}

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
 * Catalog display
 * ------------------------------------------------------------------ */

/**
 * Which optional catalog features the storefront offers.
 *
 * Shop-wide and independent of one another — a wholesale catalogue may want
 * comparison and no wishlist. Turning one off is a presentation decision only:
 * the backend keeps whatever shoppers have already saved under it, so the switch
 * is reversible without cost.
 */
export interface CatalogConfig {
  showWishlist: boolean
  showCompare: boolean
  /** Off, a product with variants opens its own page instead of a preview. */
  showQuickView: boolean
}

/**
 * Mirrors the backend's `DEFAULT_CATALOG_CONFIG`.
 *
 * Seeds the editor for a store whose column has never been written, so the
 * switches show what the storefront is actually doing rather than defaulting to
 * off. Keep in step with the backend — same obligation `DEFAULT_CHECKOUT_CONFIG`
 * already carries.
 */
export const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  showWishlist: true,
  showCompare: true,
  showQuickView: true,
}

/* ------------------------------------------------------------------ *
 * SEO
 * ------------------------------------------------------------------ */

/**
 * The route groups a storefront page can belong to.
 *
 * A CLOSED set mirroring the backend's `SEO_ROUTE_GROUPS`, in the order the
 * Indexing screen renders them: public surfaces first, then the private ones a
 * shop never wants indexed.
 */
export const SEO_ROUTE_GROUPS = [
  'home',
  'product',
  'category',
  'blog',
  'page',
  'landingPage',
  'account',
  'cart',
  'checkout',
  'wishlist',
  'compare',
  'search',
] as const

export type SeoRouteGroup = (typeof SEO_ROUTE_GROUPS)[number]

export const SEO_CONTENT_TYPES = [
  'product',
  'category',
  'page',
  'blogPost',
  'landingPage',
] as const

export type SeoContentType = (typeof SEO_CONTENT_TYPES)[number]

export interface SeoRobotsGroup {
  index: boolean
  follow: boolean
}

export interface SeoConfig {
  /** `%s` is replaced by the page's title. `''` means no template. */
  titleTemplate: string
  defaultMetaTitle: string
  defaultMetaDescription: string
  defaultOgImageUrl: string
  twitterCardType: 'summary' | 'summary_large_image'
  twitterSite: string
  robots: {
    /** Overrides every group below, and empties the sitemap. */
    globalNoindex: boolean
    groups: Record<SeoRouteGroup, SeoRobotsGroup>
    customRules: string
  }
  sitemap: Record<SeoContentType, boolean>
  structuredData: {
    enableOrganization: boolean
    enableProduct: boolean
    enableArticle: boolean
    enableBreadcrumb: boolean
    organization: {
      legalName: string
      logoUrl: string
      email: string
      phone: string
      sameAs: string[]
    }
  }
  verification: {
    google: string
    bing: string
    other: string
  }
}

/**
 * Mirrors the backend's `DEFAULT_SEO_CONFIG`. Keep in step with it — the same
 * obligation `DEFAULT_CATALOG_CONFIG` above already carries.
 *
 * Seeds all four SEO screens for a store whose column has never been written,
 * so they show what the storefront is actually doing rather than reading as
 * off — which for an `index` flag would be a page withdrawn from search by the
 * UI's own default rather than by anyone's decision.
 */
export const DEFAULT_SEO_CONFIG: SeoConfig = {
  titleTemplate: '',
  defaultMetaTitle: '',
  defaultMetaDescription: '',
  defaultOgImageUrl: '',
  twitterCardType: 'summary_large_image',
  twitterSite: '',
  robots: {
    globalNoindex: false,
    groups: {
      home: { index: true, follow: true },
      product: { index: true, follow: true },
      category: { index: true, follow: true },
      blog: { index: true, follow: true },
      page: { index: true, follow: true },
      landingPage: { index: true, follow: true },
      account: { index: false, follow: false },
      cart: { index: false, follow: false },
      checkout: { index: false, follow: false },
      wishlist: { index: false, follow: false },
      compare: { index: false, follow: false },
      search: { index: false, follow: false },
    },
    customRules: '',
  },
  sitemap: { product: true, category: true, page: true, blogPost: true, landingPage: true },
  structuredData: {
    enableOrganization: true,
    enableProduct: true,
    enableArticle: true,
    enableBreadcrumb: true,
    organization: { legalName: '', logoUrl: '', email: '', phone: '', sameAs: [] },
  },
  verification: { google: '', bing: '', other: '' },
}

/** How long a meta title/description can be before search engines truncate it. */
export const SEO_LENGTH_LIMITS = {
  titleMax: 60,
  descriptionMax: 160,
} as const

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
  /** The storefront's typeface. */
  font: ThemeFont
  /**
   * The ADMIN PANEL's typeface, chosen independently of the storefront's.
   *
   * Optional here because the admin read returns the stored row as-is: a theme
   * saved before this key existed genuinely has no `adminFont`, and the editor
   * needs to be able to tell that from "configured". The PUBLIC read resolves
   * it from the default, so the panel itself never sees it missing.
   */
  adminFont?: ThemeFont
}

/**
 * A font on the way IN, which is not the shape it comes out in.
 *
 * `{ family }` picks a font from the library — what both pickers send. The
 * backend looks the family up and stores its `{ family, url }`; an unknown
 * family is a 400. A bare string is also still accepted by the endpoint (a
 * pasted `@import`, `<link>` or URL) but the admin no longer sends one: pasting
 * moved to the font library, where a font is added once and then selected.
 */
export type FontSelection = { family: string }

/**
 * What the PATCH accepts for `theme`.
 *
 * Both fonts go up as selections rather than pasted text. `adminFont` stays
 * optional on the wire so an editor that has no opinion about the admin's
 * typeface does not have to send one — the backend carries the stored value
 * forward rather than blanking it.
 */
export type ThemeInput = Omit<Theme, 'font' | 'adminFont'> & {
  font: FontSelection
  adminFont?: FontSelection
}

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
  /**
   * Which of the two things each brand slot shows, decided independently.
   *
   * Nullable here and not on the storefront's copy: the ADMIN read returns the
   * row as-is while the public read merges defaults, so `null` means "this
   * store has never chosen" — which is why the editor seeds from
   * `DEFAULT_BRAND_DISPLAY` rather than assuming a value.
   */
  headerBrandMode: BrandDisplayMode | null
  footerBrandMode: BrandDisplayMode | null
  headerLogoHeight: number | null
  footerLogoHeight: number | null
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
  /** Null until a merchant opens Catalog Setting — same "not configured" distinction as above. */
  catalogConfig: CatalogConfig | null
  /** Null until a merchant saves any SEO screen — same distinction again. */
  seoConfig: SeoConfig | null
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

  /**
   * Which courier the shop dispatches through.
   *
   * The SELECTION only — credentials stay in the server's environment, because
   * this row is served publicly. Never null: a shop using a courier with no
   * integration selects `MANUAL`, which is a real provider declaring no
   * capabilities rather than an absent choice.
   *
   * The backend refuses to change this while consignments are in flight with
   * the current courier, and says how many.
   */
  courierProvider: CourierProvider
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
  /** Sent unconditionally by the site-settings editor — a mode always has a value. */
  headerBrandMode?: BrandDisplayMode
  footerBrandMode?: BrandDisplayMode
  /** Pixels, bounded by `LOGO_HEIGHT_LIMITS`. Refused outside it by the backend. */
  headerLogoHeight?: number
  footerLogoHeight?: number
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
  catalogConfig?: CatalogConfig
  /**
   * The WHOLE SEO config, never a slice of one.
   *
   * Unlike every other key here, the backend does not merge this one field by
   * field — a present `seoConfig` replaces the stored blob outright. The four
   * SEO screens each edit one facet of it, so each must send the full object it
   * loaded with its own section's edits applied. Sending only the section's own
   * keys would blank the other three.
   */
  seoConfig?: SeoConfig
  /**
   * Both fonts go up as `{ family }` selections from the font library; the
   * backend resolves each to its stored `{ family, url }`. See `ThemeInput`.
   */
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

  /**
   * Sent only by the Courier settings screen, which is the one place the
   * consequences of the choice are shown.
   *
   * `.optional()` and never null — unlike `activeLandingPageId` above, there is
   * no deselected state to express.
   */
  courierProvider?: CourierProvider
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
  /*
   * Empty, and collection off — the same default the backend carries, and the
   * state a store that has never configured delivery is genuinely in. There is
   * no delivery setup that is right for an arbitrary shop: an area named for the
   * wrong city, or a price nobody chose, would be worse than nothing because it
   * would be charged. Checkout refuses to price an order until the merchant
   * fills this in, and the form refuses to SAVE an empty list — so the emptiness
   * is a visible setup step rather than a silently wrong charge.
   */
  delivery: { offersPickup: false, options: [] },
}

/**
 * Mirrors the backend's `DEFAULT_THEME` in
 * `server/src/app/module/store-setting/store-setting.constant.ts` and carries
 * the standing obligation to be kept in step with it.
 */
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
  /**
   * Roboto, not Outfit, and the difference is deliberate: Roboto is what the
   * admin panel was hardcoded to before it became configurable. An install that
   * never touches the setting therefore looks exactly as it did. Changing this
   * silently restyles every panel that never opted in.
   */
  adminFont: {
    family: 'Roboto',
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap',
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
