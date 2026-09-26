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

/**
 * One link action in the header's MAIN row, beside the cart.
 *
 * Shaped like an `AnnouncementLink` minus `source`, and that omission is the distinction rather
 * than an oversight: a link bound to the store's phone or email IS a contact detail, and contact
 * details belong in the announcement strip above. These are ordinary links.
 *
 * The storefront renders these only from `md` up, inside the action group that already hides
 * below it. See server/openspec/changes/add-header-middle-bar-links, design.md Decision 4.
 */
export interface MiddleBarLink extends NavChild {
  /** An Iconify name, e.g. `fa-solid:truck`. */
  icon?: string
}

/**
 * Mirrors the backend's `DEFAULT_MIDDLE_BAR_LINKS`.
 *
 * Seeds the editor for a store whose column has never been written. The admin read returns the
 * row as stored — unlike the public endpoint, which merges defaults — so without this mirror the
 * panel could not tell "never configured" from "configured to exactly this". The same obligation
 * `DEFAULT_HOME_CONFIG` and `DEFAULT_CATALOG_CONFIG` already carry.
 */
export const DEFAULT_MIDDLE_BAR_LINKS: MiddleBarLink[] = [
  { icon: 'fa-solid:truck', label: 'Track Order', href: '/track-order' },
]

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

/**
 * One column of the home page's perks band.
 *
 * Every field required, unlike the optional `icon` on a middle-bar link: the
 * band is a row of aligned columns, so a perk missing any of the three renders
 * as a hole in it. The backend's `perksSchema` enforces the same.
 */
export interface Perk {
  /** An Iconify name, e.g. `lucide:truck`. Resolved by the STOREFRONT only. */
  icon: string
  title: string
  description: string
}

/**
 * The four columns a store that has never edited its perks band is showing.
 *
 * Mirrors the backend's `DEFAULT_PERKS` and exists for the same reason
 * `DEFAULT_MIDDLE_BAR_LINKS` above does: the admin read returns the row AS
 * STORED rather than merged over defaults, so without this the editor could not
 * tell "never configured" from "configured to exactly this", and would show a
 * merchant four empty rows for a band their site is visibly rendering.
 *
 * Deliberately NOT improved copy. These are the words the storefront hardcoded,
 * so seeding them reproduces what the site already says; changing one here
 * would edit every unconfigured store's home page from the admin's side of the
 * wire, where nothing records that a merchant chose it.
 */
export const DEFAULT_PERKS: Perk[] = [
  { icon: 'lucide:truck', title: 'Free Shipping', description: 'For orders over ৳130.' },
  { icon: 'lucide:rotate-ccw', title: 'Money Return', description: '30 days for an exchange' },
  { icon: 'lucide:gift', title: 'Member Discount', description: 'Shop smart and save bigger' },
  { icon: 'lucide:headset', title: 'Special Gifts', description: 'Contact us anytime' },
]

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
 * The public half of integration configuration.
 *
 * MIRRORS `integrationConfigSchema` in the backend's store-setting.validation.ts
 * and must be kept in step with it — the same standing obligation
 * `DEFAULT_CATALOG_CONFIG` and `SETTINGS_LIMITS` carry. A field added there and
 * not here is a field the panel silently drops on every save, because a present
 * `integrationConfig` replaces the whole column.
 */
export interface IntegrationConfig {
  facebookPixel?: {
    enabled: boolean
    /** Digits only, 5–20. Bounded because the storefront interpolates it into a
     *  script bootstrap; see the backend schema for the full reasoning. */
    pixelId: string
  }
  facebookCapi?: {
    enabled: boolean
    testMode: boolean
    /** Required by the backend whenever `testMode` is on. */
    testEventCode: string
  }
}

/**
 * What an unconfigured shop's Integrations page shows.
 *
 * Both features OFF. The page seeds from this rather than from `{}` so that
 * "never configured" and "configured and switched off" render identically and
 * correctly — and so a merchant who has never opened the page cannot have
 * tracking silently enabled by a default.
 */
export const DEFAULT_INTEGRATION_CONFIG: Required<IntegrationConfig> = {
  facebookPixel: { enabled: false, pixelId: '' },
  facebookCapi: { enabled: false, testMode: false, testEventCode: '' },
}

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

/**
 * Mirrors the backend's `.max(...)` caps. A save past one of these is rejected there.
 *
 * The `*Length` entries are the per-string caps from the same schemas. They were missing while the
 * count caps were present, which meant the editors bounded how MANY rows a merchant could add but
 * not how long any field could be — so a pasted label sailed past the client and came back as a 400
 * naming a Zod path. That is the exact outcome the block comment at the top of this file says these
 * constants exist to prevent.
 */
export const SETTINGS_LIMITS = {
  mainNavItems: 20,
  navChildren: 20,
  footerColumns: 6,
  footerLinksPerColumn: 20,
  announcementLinks: 6,
  /**
   * Lower than `announcementLinks` on purpose. That bar is one wide row holding a truncating
   * message; this row carries the brand, the search box and up to four built-in actions, and is
   * the one that runs out of horizontal space first — the storefront already hides Wishlist and
   * Compare below `lg` for that reason. See the backend's `middleBarLinksSchema`.
   */
  middleBarLinks: 4,
  socialLinks: 10,
  checkoutNotice: 300,
  /** `navChildSchema.label`, `footerColumnsSchema.title`, and the announcement link label. */
  labelLength: 100,
  /** `navChildSchema.href` — every nav, footer, and announcement target. */
  hrefLength: 500,
  /**
   * How many columns the perks band holds. A LAYOUT limit mirroring the
   * backend's `MAX_PERKS`, not a storage one: the band is a single row of equal
   * columns — four across on a laptop, two on a tablet — so a fifth either
   * wraps into a ragged second row or squeezes every supporting line until it
   * breaks mid-word.
   */
  perks: 4,
  /** `perksSchema.title`. */
  perkTitleLength: 100,
  /** `perksSchema.description`. */
  perkDescriptionLength: 200,
  /** The announcement link's Iconify name, and a perk's. */
  iconLength: 100,
  /** `announcementBarSchema.text`. */
  announcementTextLength: 300,
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

/** Which mobile-money service receives the advance. */
export type MobileBankingProvider = 'BKASH' | 'NAGAD' | 'ROCKET'

/** The providers the form offers, in the order it offers them. */
export const MOBILE_BANKING_PROVIDERS: MobileBankingProvider[] = ['BKASH', 'NAGAD', 'ROCKET']

/**
 * One mobile-banking account a shopper sends the advance to.
 *
 * `id` is generated once when the account is added and NEVER rewritten — a
 * placed order's payment row references it, so editing the number or reordering
 * the list must not reattach historical claims to a different account. This is
 * stricter than a delivery option's `key`, which is generated positionally and
 * survives renames but not reordering: fine for a label, wrong for a reference.
 */
export interface MobileBankingAccount {
  id: string
  provider: MobileBankingProvider
  number: string
  /** The merchant's own label — "Personal", "Merchant". Nothing branches on it. */
  accountType: string
  /**
   * The service's logo, uploaded here and shown beside the account on checkout.
   *
   * Optional, and absent rather than empty on an account saved before the field
   * existed — the storefront falls back to the mark it ships with. Cleared by
   * writing "", which is what the backend accepts beside a URL: this block is
   * replaced wholesale on save, so an omitted key is not "leave unchanged".
   */
  iconUrl?: string
}

/** One bank account a shopper deposits the advance into. `id` as above. */
export interface BankAccount {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  /** The bank's logo. Optional and cleared with "", exactly as on a mobile account. */
  iconUrl?: string
  /** Both may be blank: a same-bank transfer needs neither. */
  branch: string
  routingNumber: string
}

/**
 * Whether the store collects money before it ships, and where it goes.
 *
 * Mirrors `advancePaymentSchema` in the backend's store-setting.validation.ts
 * and carries the standing obligation to be kept in step with it. See
 * server/openspec/changes/add-advance-payment-checkout.
 */
export interface AdvancePaymentConfig {
  enabled: boolean
  mobileAccounts: MobileBankingAccount[]
  bankAccounts: BankAccount[]
}

/** Mirrors the backend's bound, so the form stops adding before the API refuses. */
export const MAX_PAYMENT_ACCOUNTS = 10

export interface CheckoutConfig {
  fields: Record<CheckoutFieldKey, CheckoutField>
  /** Governs the coupon box on the cart page AND the checkout page together. */
  showCouponBox: boolean
  showOrderNote: boolean
  allowGuestCheckout: boolean
  /** Rendered above the storefront's Place Order button. Empty renders nothing. */
  notice: string
  delivery: DeliverySettings
  advancePayment: AdvancePaymentConfig
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
  /**
   * Off, adding something leaves the customer where they are instead of opening
   * the cart panel over the page. Every way of opening the cart deliberately —
   * the header button, the mobile bar, the floating tab — is unaffected either
   * way. See server/openspec/changes/add-product-slider-and-card-quantity.
   */
  openCartOnAdd: boolean
  /**
   * On, a product already in the cart shows a quantity stepper on its card in
   * the listing instead of the Add to cart button.
   *
   * OFF by default, unlike the flags above: they withdraw something that was
   * always there, this adds something that never was. See
   * server/openspec/changes/add-product-slider-and-card-quantity.
   */
  cardQuantityControl: boolean
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
  openCartOnAdd: true,
  // False where the rest are true — see the field's note above.
  cardQuantityControl: false,
}

/* ------------------------------------------------------------------ *
 * Home page sections
 * ------------------------------------------------------------------ */

/**
 * Every section the storefront homepage can be composed from.
 *
 * Mirrors HOME_SECTION_KEYS in the backend's store-setting.constant.ts, which is
 * the authority. A KEY IS PERMANENT once released — stored configurations name
 * sections by these strings — but the `label` below is only what this panel
 * prints and may be reworded freely.
 */
export type HomeSectionKey =
  | 'HERO'
  | 'BRAND_BAR'
  | 'FEATURED_CATEGORIES'
  | 'BEST_SELLING'
  | 'MID_BANNERS'
  | 'FEATURED_PRODUCTS'
  | 'PERKS_BAR'
  | 'DEAL_OF_WEEK'
  | 'NEW_ARRIVALS'
  | 'TESTIMONIALS'
  | 'BLOG'
  | 'NEWSLETTER'

/**
 * The hero's LAYOUT — how its artwork is arranged, as distinct from the artwork
 * itself, which is banners keyed by placement.
 *
 * MIRRORS `HERO_VARIANTS` in the backend's store-setting.constant.ts, IN ORDER,
 * because position 0 is the default there and `SPLIT_THREE` holds it: that is
 * the arrangement the storefront rendered before layouts were selectable.
 * Reorder this and the picker offers a different default than the website uses.
 *
 * All four draw on the same three hero placements. A layout that does not
 * render a slot simply does not read it — the banners stay on file untouched.
 *
 * `SPLIT_ONE` was withdrawn on request; see the backend's `HERO_VARIANTS` for
 * why and for what happens to a store that had chosen it. This union is the
 * panel's mirror, so the picker simply stops offering it — and because the
 * backend now REFUSES a write of it, offering it here would produce a 400 the
 * merchant could not act on.
 */
export type HeroVariant = 'SPLIT_THREE' | 'FULL_SLIDER' | 'SLIDER_STACK' | 'SPLIT_TALL'

/**
 * The featured-categories section's LAYOUT — how its tiles are arranged, as
 * distinct from which categories appear.
 *
 *   GRID     the tiles in a wrapping grid, seven across at desktop  (DEFAULT)
 *   SLIDER   the same tiles in one horizontal row that scrolls
 *
 * MIRRORS `FEATURED_CATEGORIES_VARIANTS` in the backend's
 * store-setting.constant.ts, IN ORDER, for the reason `HeroVariant` above
 * mirrors `HERO_VARIANTS`: position 0 is the default there, and the picker
 * renders the tuple in order with the first pre-selected. Reorder this and the
 * panel offers a different default than the website uses.
 *
 * See server/openspec/changes/add-featured-categories-layout.
 */
export type FeaturedCategoriesLayout = 'GRID' | 'SLIDER'

/**
 * How a homepage row of PRODUCTS is arranged — `BEST_SELLING`,
 * `FEATURED_PRODUCTS` and `NEW_ARRIVALS`, which all offer the same two.
 *
 * Deliberately NOT aliased to `FeaturedCategoriesLayout` although the members
 * coincide today: they answer for different sections and either could gain a
 * layout the other never offers. Mirrors `PRODUCT_ROW_VARIANTS` in the
 * backend's store-setting.constant.ts, first entry the default. See
 * server/openspec/changes/add-product-slider-and-card-quantity.
 */
export type ProductRowLayout = 'GRID' | 'SLIDER'

/**
 * Every layout any section offers. A section entry carries at most one, and
 * which union it belongs to is decided by the entry's `key`.
 */
export type SectionLayout = HeroVariant | FeaturedCategoriesLayout | ProductRowLayout

/**
 * The layout picker's options, in registry order, first one the default.
 *
 * The descriptions say what the merchant will SEE, not what the key is called.
 * `SPLIT_THREE` and `SLIDER_STACK` use the same three slots and differ only in
 * where they sit, which is why the picker draws each one as well as naming it —
 * no sentence short enough for a label makes that difference legible.
 */
export const HERO_VARIANT_OPTIONS: { value: HeroVariant; label: string; description: string }[] = [
  {
    value: 'SPLIT_THREE',
    label: 'Slider with three tiles',
    description:
      'A rotating slider on the left, two square tiles and one wide tile on the right. The standard layout.',
  },
  {
    value: 'FULL_SLIDER',
    label: 'Full-width slider',
    description:
      'One wide rotating slider across the page and nothing else. The biggest single image, with nothing competing against it.',
  },
  {
    value: 'SLIDER_STACK',
    label: 'Slider above three tiles',
    description:
      'A full-width rotating slider with a row of three tiles beneath it. Fits the most promotions above the fold.',
  },
  {
    value: 'SPLIT_TALL',
    label: 'Slider with tall tile',
    description:
      'A wide rotating slider on the left and one tall promotion filling the right third. One story, one offer.',
  },
]

/**
 * The featured-categories layout picker's options, in registry order, first
 * one the default. Chosen on the Home Sections row — not on a page of its own
 * like the hero's — because the choice moves no artwork guidance and the row
 * already owns and writes `homeConfig`. See
 * server/openspec/changes/add-featured-categories-layout, design.md Decision 2.
 */
export const FEATURED_CATEGORIES_LAYOUT_OPTIONS: {
  value: FeaturedCategoriesLayout
  label: string
  description: string
}[] = [
  {
    value: 'GRID',
    label: 'Grid',
    description: 'Every category tile at once, in rows that wrap. The standard layout.',
  },
  {
    value: 'SLIDER',
    label: 'Slider',
    description:
      'The same tiles in one row that customers scroll sideways. Keeps a long category list to one line.',
  },
]

/**
 * The product-row layout picker's options, in registry order, first one the
 * default. One array for all three rows: they offer the same two layouts, and
 * stating it once is what keeps the three pickers identical. Each row still
 * stores its own choice, so a merchant may set them differently.
 *
 * See server/openspec/changes/add-product-slider-and-card-quantity.
 */
export const PRODUCT_ROW_LAYOUT_OPTIONS: {
  value: ProductRowLayout
  label: string
  description: string
}[] = [
  {
    value: 'GRID',
    label: 'Grid',
    description: 'Every product at once, in rows that wrap. The standard layout.',
  },
  {
    value: 'SLIDER',
    label: 'Slider',
    description:
      'The same products in one row that customers scroll sideways. Keeps a long row to one line.',
  },
]

/** One section's placement and visibility. Position in `HomeConfig` is its order. */
export interface HomeSection {
  key: HomeSectionKey
  enabled: boolean
  /**
   * The section's layout, on sections that offer a choice — `HERO`,
   * `FEATURED_CATEGORIES` and the three product rows (`BEST_SELLING`,
   * `FEATURED_PRODUCTS`, `NEW_ARRIVALS`). Which values are legal depends on
   * `key`; the type is
   * the union of every section's layouts because one field serves every entry.
   *
   * Optional in the type, always present in practice: the backend resolves it
   * on every read. The panel renders what it is given and never defaults it, so
   * this panel and the live storefront cannot disagree about what a store looks
   * like. (The one exception is the Home Sections page's ADMIN read, which is
   * the raw row — that page falls back to the section's default for display
   * only, and never writes the fallback.)
   */
  variant?: SectionLayout
  /**
   * Which promo banner group this entry renders — `MID_BANNERS` ONLY.
   *
   * ── THIS FIELD MUST SURVIVE EVERY WRITE FROM THIS PANEL ───────────────
   *
   * The Home Sections page reads the stored list, filters it against
   * `HOME_SECTION_REGISTRY`, and sends `homeConfig` back WHOLESALE on save. An
   * entry that loses its `groupId` on that path names no strip, so the server
   * drops it on the very next read — every promo strip disappears on the
   * merchant's first unrelated save, with no error anywhere. That page's filter
   * keeps whole entries for exactly this reason; the hero's `variant` already
   * carries the same hazard.
   *
   * `MID_BANNERS` is also THE ONE KEY THAT MAY REPEAT, once per strip. Anything
   * matching entries in this array must match on `key` + `groupId`, or on
   * position — never on `key` alone, which would treat every promo strip as one.
   *
   * MIRRORS the backend's `HomeSectionConfig.groupId`. See
   * server/openspec/changes/add-promo-banner-groups, design.md Decision 3.
   */
  groupId?: string
}

/**
 * The homepage's sections in render order. ORDER IS THE DATA — this array is
 * never sorted on the way to or from the API.
 *
 * Every key appears at most once EXCEPT `MID_BANNERS`, which appears once per
 * promo banner group.
 */
export type HomeConfig = HomeSection[]

/**
 * The one section key that may appear more than once in a `homeConfig`.
 *
 * Named rather than written as a literal at each place that branches on it:
 * every one of those is somewhere that treating promo strips as a single
 * section silently merges them. Mirrors the backend's `PROMO_SECTION_KEY`.
 */
export const PROMO_SECTION_KEY = 'MID_BANNERS' as const satisfies HomeSectionKey

/**
 * What each section is, in the merchant's words.
 *
 * The description says what the section SHOWS rather than restating its name,
 * because "Brand bar" tells a merchant nothing about which part of their
 * homepage vanishes when they switch it off — and that is the one thing they
 * need to know before touching the switch. Same reasoning as the consequence
 * copy on Catalog Setting.
 *
 * Order here mirrors the backend's registry order, which is the default layout
 * of the page. It is the order a never-configured store is shown, NOT the order
 * a configured store renders in — that comes from the stored list.
 */
export const HOME_SECTION_REGISTRY: {
  key: HomeSectionKey
  label: string
  description: string
}[] = [
  {
    /*
     * The description no longer names the slider and its side tiles. It did,
     * and that described ONE of four arrangements as though it were the only
     * one — a store on the full-width slider has no side tiles at all. Which
     * arrangement is in use is chosen on the Home Slider page, and that row
     * links across to it.
     */
    key: 'HERO',
    label: 'Hero banners',
    description: 'The big banner area at the very top of the home page.',
  },
  {
    key: 'BRAND_BAR',
    label: 'Brand strip',
    description: 'The scrolling row of brand logos.',
  },
  {
    key: 'FEATURED_CATEGORIES',
    label: 'Featured categories',
    // Not "the grid": the section has two layouts now, and this line must
    // describe what it SHOWS whichever one is chosen.
    description: 'The category tiles customers browse from — as a grid or a scrolling row.',
  },
  {
    key: 'BEST_SELLING',
    label: 'Best selling products',
    description: 'A row of your best sellers, by number of units sold.',
  },
  {
    /*
     * The description no longer says "three". A merchant may now have several
     * promo strips, each showing one, two or three tiles — so naming a count
     * here would describe ONE possible arrangement as though it were the only
     * one, the same correction the HERO entry above already carries.
     *
     * This label is also only the FALLBACK for a promo row: with groups loaded,
     * each row is named after the strip the merchant named.
     */
    key: 'MID_BANNERS',
    label: 'Promo banners',
    description: 'A row of promotional tiles. Manage the strips under Promo Banners.',
  },
  {
    key: 'FEATURED_PRODUCTS',
    label: 'Featured products',
    description: 'A row of the products you have marked as featured.',
  },
  {
    key: 'PERKS_BAR',
    label: 'Perks strip',
    // Says it is editable, because it now is: its four columns were fixed in
    // the storefront's source until add-perks-strip-content, and a description
    // that only names what it happens to say today would read as a fixed block.
    description: 'The coloured band of promises — delivery, returns, support. Edit its columns here.',
  },
  {
    key: 'DEAL_OF_WEEK',
    label: 'Deal of the week',
    description: 'The countdown block for your current deal campaign.',
  },
  {
    key: 'NEW_ARRIVALS',
    label: 'New arrivals',
    description: 'A row of your most recently added products.',
  },
  {
    key: 'TESTIMONIALS',
    label: 'Customer testimonials',
    description: 'What your customers have said about you.',
  },
  {
    key: 'BLOG',
    label: 'Recent blog posts',
    description: 'Your latest published articles.',
  },
  /*
   * LAST, matching the backend registry exactly — the two orders are what a
   * merchant sees before they reorder anything, and disagreeing would mean this
   * panel showing one default while the website renders another.
   *
   * The label and description are ours to word; only the KEY is fixed. The
   * backend's `HOME_SECTION_KEYS` is explicit that a key is permanent once
   * released, because stored configurations name sections by these strings.
   */
  {
    key: 'NEWSLETTER',
    label: 'Newsletter signup',
    description:
      'The email signup band. It used to sit in your footer on every page; it is now a home page section you can move or switch off.',
  },
]

/**
 * Mirrors the backend's `DEFAULT_HOME_CONFIG`: every section on, registry order.
 *
 * Seeds the editor for a store whose column has never been written, so the page
 * shows what the homepage is ACTUALLY doing rather than reading as though every
 * section were off. The admin read returns the row as stored — unlike the public
 * endpoint, which merges defaults — so without this mirror the panel could not
 * tell "never configured" from "configured to exactly the default". The same
 * obligation `DEFAULT_CATALOG_CONFIG` above already carries.
 *
 * NO `variant` HERE, matching the backend's own default exactly. Absent already
 * resolves to the section's default on read, so writing one in would create two
 * representations of one state that would then have to be kept equivalent
 * forever. See openspec/changes/add-hero-section-variants, design.md Decision 5.
 */
export const DEFAULT_HOME_CONFIG: HomeConfig = HOME_SECTION_REGISTRY.filter(
  /*
   * NO PROMO ENTRY IN THE DEFAULT. A promo entry names the strip it renders,
   * and this seed knows of no strips — a groupless one would be rejected by the
   * server's write schema, so seeding it would make the merchant's first save
   * from a never-configured store fail. The server splices an entry in per
   * group on read, which is where promo rows actually come from.
   */
  ({ key }) => key !== PROMO_SECTION_KEY,
).map(({ key }) => ({
  key,
  enabled: true,
}))

/**
 * Which navigation targets the storefront hides when their homepage section is switched off.
 *
 * A merchant who disables "Recent blog posts" keeps a "Blog" link in their header unless
 * something reconciles the two, and concludes the switch did not work. The storefront applies
 * this rule at render time; this mirror is what lets BOTH editors say so before the merchant
 * goes looking at their live site.
 *
 * MIRRORS `SECTION_LINKED_ROUTES` in `nextjs/src/lib/nav-sections.ts` and is kept in step by
 * hand, like `HOME_SECTION_REGISTRY` above. Drift here is nothing like as dangerous as drift in
 * that registry: a missing key there is silently deleted from the merchant's saved config by the
 * next unrelated save, whereas a wrong entry here only makes a notice appear where no link is
 * hidden, or fail to appear where one is — wrong and visible, never destructive.
 *
 * Keys are exact, whole-string matches on the stored `href`, and each is one of the
 * `STOREFRONT_ROUTES` the target picker offers. ADDING A ROUTE TO THAT PICKER DOES NOT GOVERN
 * IT — that takes an entry here and in the storefront's copy, deliberately.
 *
 * See server/openspec/changes/align-nav-links-with-home-sections, design.md Decisions 2 and 3.
 */
export const SECTION_LINKED_ROUTES: Readonly<Record<string, HomeSectionKey>> = {
  '/blogs': 'BLOG',
  '/deals': 'DEAL_OF_WEEK',
  '/products?sort=new': 'NEW_ARRIVALS',
  '/products?sort=best': 'BEST_SELLING',
}

/**
 * The section that governs this link target, with the label both editors show for it.
 *
 * One lookup shared by Header Links and Home Sections so the two cannot name the same section
 * differently — the merchant is being sent from one screen to the other, and a section called
 * one thing on the page they left and another on the page they arrive at is worse than no
 * notice at all. Returns `null` for an ungoverned target, which is most of them.
 */
export function findGoverningSection(href: string) {
  const key = SECTION_LINKED_ROUTES[href]
  if (!key) return null

  const entry = HOME_SECTION_REGISTRY.find((section) => section.key === key)
  return entry ? { key, label: entry.label } : null
}

/**
 * Whether the storefront still renders a link to this target.
 *
 * `homeConfig` is the list to judge against — the SAVED one on Header Links, which does not own
 * that field, and the LIVE DRAFT on Home Sections, where the merchant is mid-decision and the
 * notice should track the switch they just flipped. A section missing from the list counts as
 * enabled, matching the storefront.
 */
export function isNavHrefVisible(href: string, homeConfig: HomeConfig): boolean {
  const governing = findGoverningSection(href)
  if (!governing) return true

  const section = homeConfig.find((entry) => entry.key === governing.key)
  return section ? section.enabled : true
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
  /** The browser-tab icon. Null means the merchant chose none and the website falls back to its own. */
  faviconUrl: string | null
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
  /** Null until a merchant saves the header editor; the page seeds from DEFAULT_MIDDLE_BAR_LINKS. */
  middleBarLinks: MiddleBarLink[] | null
  newsletter: Newsletter | null
  /**
   * The perks band's columns. Null until a merchant saves Home sections — the
   * same "not configured" distinction as `middleBarLinks` above, which is why
   * the editor seeds from `DEFAULT_PERKS` rather than from an empty list.
   */
  perks: Perk[] | null
  /**
   * Null until a merchant saves the page. The two editors seed their forms from
   * the backend's own defaults in that case, so "never configured" and
   * "configured to the defaults" stay distinguishable in the stored row.
   */
  checkoutConfig: CheckoutConfig | null
  /** Null until a merchant opens Catalog Setting — same "not configured" distinction as above. */
  catalogConfig: CatalogConfig | null
  /**
   * Which homepage sections are shown, and in what order. Null until a merchant
   * opens Home Sections — same "not configured" distinction as above, which is
   * why the editor seeds from `DEFAULT_HOME_CONFIG` rather than from an empty
   * list.
   *
   * Served here AS STORED. The public endpoint reconciles this against the
   * backend's section registry before the storefront sees it, so a list read
   * here may be shorter than the registry — that is a config saved before a
   * section shipped, not a corrupt one.
   */
  homeConfig: HomeConfig | null
  /** Null until a merchant saves any SEO screen — same distinction again. */
  seoConfig: SeoConfig | null
  /**
   * The PUBLIC half of integration configuration — same "not configured"
   * distinction as the blobs above, which is why the Integrations page seeds
   * from `DEFAULT_INTEGRATION_CONFIG` rather than from an empty object.
   *
   * The CAPI access token is deliberately NOT here. It is a secret, so it lives
   * in the credential store behind `/integrations`, and this column is served by
   * a public endpoint. The two halves of that one feature are stored apart on
   * purpose — see `lib/api/integrations.ts`.
   */
  integrationConfig: IntegrationConfig | null
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
  /**
   * The browser-tab icon. `| null` unlike the two logo URLs above, and that
   * difference is load-bearing rather than an inconsistency.
   *
   * Every other optional key here says "leave unchanged" by being omitted, so
   * there is no way to express REMOVE for a field whose empty value is not
   * itself valid — which is why clearing a logo through this panel does nothing
   * today. The backend makes `faviconUrl` nullable specifically to fix that, so
   * send `null` to take an icon down. Never `''`: the backend rejects it.
   */
  faviconUrl?: string | null
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
  middleBarLinks?: MiddleBarLink[]
  newsletter?: Newsletter
  /**
   * The WHOLE ordered list, never a slice of one — a present value replaces the
   * stored column outright, exactly like `homeConfig` below. `[]` clears the
   * band; omitting the key leaves it untouched.
   */
  perks?: Perk[]

  checkoutConfig?: CheckoutConfig
  catalogConfig?: CatalogConfig
  /**
   * The WHOLE ordered section list, never a slice of one.
   *
   * Like `seoConfig` below, a present value replaces the stored column outright
   * — the backend does not merge an array field by field, and could not: the
   * array's own order is the data. Home Sections therefore always sends the
   * complete list it is displaying.
   */
  homeConfig?: HomeConfig
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
   * Replaces the stored column outright, like `seoConfig` above — the merge does
   * not recurse. The Integrations page owns both halves of this blob and sends
   * them together, so there is no second editor to clobber.
   */
  integrationConfig?: IntegrationConfig
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
  /*
   * Off with no accounts — the state every store is in until a merchant sets
   * this up, and the one the backend normalises an absent value to. Seeding it
   * here is what lets the editor tell "never configured" from "configured and
   * turned off": the admin read returns the row as-is, unlike the public
   * endpoint which merges defaults, so without this constant the form could
   * not distinguish the two.
   */
  advancePayment: { enabled: false, mobileAccounts: [], bankAccounts: [] },
}

/**
 * The advance-payment block a store that has never configured it has.
 *
 * Exported separately from `DEFAULT_CHECKOUT_CONFIG` because the accounts
 * editor seeds from this alone — it writes one key of `checkoutConfig` and must
 * not carry the rest of the default in, which would clobber the field and
 * delivery settings the checkout editor owns.
 */
export const DEFAULT_ADVANCE_PAYMENT: AdvancePaymentConfig =
  DEFAULT_CHECKOUT_CONFIG.advancePayment

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

/**
 * Writes a partial settings patch and refreshes what it invalidated.
 *
 * `courierProvider` is the one field on this row that a SECOND cache also
 * answers for: `/courier/config` reports the selected courier alongside the
 * capabilities of each adapter, and five surfaces read the selection from there
 * rather than from here — the Orders list and order detail (whether to offer
 * dispatch at all, and under whose name), the Courier page, its balance card,
 * and the dispatch preview. That query holds for five minutes, so refreshing
 * only `storeSettings.detail` leaves every one of them naming the previous
 * courier, with dispatch still offered for a provider the shop has just
 * switched away from.
 *
 * Conditioned on the payload because these editors send disjoint key sets: a
 * save from Header Links has no bearing on the courier cache and should not
 * cost a refetch of it.
 */
export function useUpdateStoreSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: (_data, input) => {
      client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail })
      if (input.courierProvider !== undefined) {
        client.invalidateQueries({ queryKey: queryKeys.courier.config })
      }
    },
  })
}
