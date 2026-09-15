import {
  LayoutDashboard,
  Newspaper,
  MessageSquareQuote,
  Package,
  Warehouse,
  ShoppingCart,
  Megaphone,
  Users,
  LifeBuoy,
  Bell,
  Settings,
  FolderTree,
  FolderOpen,
  Tag,
  SlidersHorizontal,
  Percent,
  PackagePlus,
  TicketPercent,
  ShoppingBag,
  Boxes,
  HardDrive,
  ArrowLeftRight,
  Factory,
  ClipboardList,
  ReceiptText,
  Undo2,
  Banknote,
  Truck,
  Plug,
  Type,
  Target,
  Image as ImageIcon,
  Contact,
  Star,
  Ticket,
  Store,
  ShieldCheck,
  UserCog,
  ScrollText,
  Palette,
  Rocket,
  FileText,
  GalleryHorizontal,
  LayoutList,
  PanelTop,
  PanelBottom,
  Globe,
  BarChart3,
  PackageSearch,
  TrendingUp,
  ShoppingBasket,
  History,
  Wallet,
  Search,
  Bot,
  Braces,
  BadgeCheck,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'
import type { AdminRole } from '@/lib/store/session-store'

export interface NavLinkItem {
  label: string
  path: string
  /** Every leaf carries its own icon so submenus read as scannable as the top level. */
  icon: LucideIcon
  /** Roles allowed to see/access this item. Omitted = all roles. */
  roles?: AdminRole[]
}

export interface NavSection {
  label: string
  icon: LucideIcon
  roles?: AdminRole[]
  /** A section with no children is a direct link (e.g. Dashboard, Notifications). */
  path?: string
  items?: NavLinkItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    /*
     * Orders is a direct link directly under Dashboard rather than a leaf under
     * Sales, because it is the screen a merchant opens most and opens first —
     * often the reason they logged in at all. Reaching it used to cost expanding
     * Sales past four other pages; the returns, refunds and courier screens it
     * sat with are all follow-ups to an order, read far less often, and stay
     * under Sales. The route itself is unchanged (/sales/orders), so links,
     * bookmarks and the router's nesting are untouched.
     */
    label: 'Orders',
    icon: ReceiptText,
    path: '/sales/orders',
  },
  {
    /*
     * Top-level for the same reason as Orders: of everything under Catalog it
     * is by far the most opened, and unlike the rest of that section it is
     * reached on its own rather than while setting the catalogue up.
     *
     * This costs something real, and the trade is deliberate. Catalog used to
     * be ordered build-first — the things a product refers to, then Products
     * last, because authoring one is easier once its category, brand and
     * attributes exist — and pulling Products out breaks that reading. The
     * judgement is that the build order matters once, when a shop is first
     * populated, while the trip to Products is made every day after. What is
     * left under Catalog is still in build order, so the original logic holds
     * for the screens that are actually used that way.
     *
     * Route unchanged (/catalog/products): the section's own /catalog/* paths,
     * the router and any bookmarks are untouched by the move.
     */
    label: 'Products',
    icon: ShoppingBag,
    path: '/catalog/products',
  },
  {
    label: 'Catalog',
    icon: Package,
    /*
     * Ordered the way a merchant builds a catalogue rather than
     * alphabetically: the things a product refers to come first. Products
     * itself is deliberately NOT listed here — it is a top-level link above,
     * and must not be added back as a second entry pointing at the same path.
     */
    items: [
      { label: 'Categories', path: '/catalog/categories', icon: FolderTree },
      { label: 'Sub categories', path: '/catalog/sub-categories', icon: FolderOpen },
      { label: 'Brands', path: '/catalog/brands', icon: Tag },
      { label: 'Attributes', path: '/catalog/attributes', icon: SlidersHorizontal },
      { label: 'Tax rules', path: '/catalog/tax-rules', icon: Percent },
      { label: 'Bundle deals', path: '/catalog/bundle-deals', icon: PackagePlus },
      { label: 'Vouchers', path: '/marketing/vouchers', icon: TicketPercent },
    ],
  },
  {
    label: 'Inventory',
    icon: Warehouse,
    items: [
      { label: 'Warehouses', path: '/inventory/warehouses', icon: Warehouse },
      { label: 'Stock', path: '/inventory/stock', icon: Boxes },
      { label: 'Stock Movements', path: '/inventory/stock-movements', icon: ArrowLeftRight },
      { label: 'Suppliers', path: '/inventory/suppliers', icon: Factory },
      { label: 'Purchase Orders', path: '/inventory/purchase-orders', icon: ClipboardList },
    ],
  },
  {
    /*
     * Orders is deliberately NOT listed here — it is a top-level link above
     * Catalog. What stays is everything that happens *after* an order exists.
     */
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { label: 'Returns', path: '/sales/returns', icon: Undo2 },
      { label: 'Refunds', path: '/sales/refunds', icon: Banknote },
      { label: 'Courier', path: '/sales/courier', icon: Truck },
    ],
  },
  {
    /*
     * Placed after Sales because a report is what you read once the selling,
     * buying and stock movement it describes have happened — the same
     * build-order logic Catalog's ordering follows.
     *
     * Stock report leads: it is the only one that answers a question about
     * right now rather than about a period, and it is the one a merchant opens
     * most. Stock history sits below the two money reports rather than beside
     * Stock report, because it reads as a period report, not a position.
     */
    label: 'Report',
    icon: BarChart3,
    items: [
      { label: 'Stock report', path: '/reports/stock', icon: PackageSearch },
      { label: 'Sales report', path: '/reports/sales', icon: TrendingUp },
      { label: 'Purchases report', path: '/reports/purchases', icon: ShoppingBasket },
      { label: 'Stock history', path: '/reports/stock-history', icon: History },
      { label: 'Payment history', path: '/reports/payments', icon: Wallet },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    // Vouchers moved up into Catalog to match the reference's Product menu;
    // they are not listed twice. Banners moved out to UI below — a banner is
    // storefront chrome a merchant arranges, not a campaign they run.
    items: [{ label: 'Campaigns', path: '/marketing/campaigns', icon: Target }],
  },
  {
    /*
     * Everything the shopper sees but a developer used to control: content
     * pages, the homepage hero, the remaining banner placements, and the header
     * and footer chrome. Grouped by WHERE it lands on the storefront rather
     * than by which endpoint it happens to write to — Pages hits /pages, the
     * two banner surfaces hit /banners, and both link editors patch /settings,
     * but a merchant arranging their site does not care which.
     */
    label: 'UI',
    icon: Palette,
    roles: ['OWNER', 'ADMIN'],
    items: [
      /*
       * Leads the section. A landing page is the only entry here that can take
       * an order on its own, and it is the one a merchant opens while an ad is
       * already running — which is not a moment to go hunting past six other
       * content screens.
       */
      { label: 'Landing Pages', path: '/ui/landing-pages', icon: Rocket },
      { label: 'Pages', path: '/ui/pages', icon: FileText },
      { label: 'Blog', path: '/ui/blog', icon: Newspaper },
      { label: 'Testimonials', path: '/ui/testimonials', icon: MessageSquareQuote },
      /*
       * Directly above Home Slider, because it is the wider decision of the
       * two: this page says whether the home page has a hero at all, and that
       * one says what is in it. A merchant who switches the hero off and then
       * opens the slider to wonder why their banners are not showing has been
       * sent the wrong way round.
       */
      { label: 'Home Sections', path: '/ui/home-sections', icon: LayoutList },
      { label: 'Home Slider', path: '/ui/home-slider', icon: GalleryHorizontal },
      { label: 'Banners', path: '/ui/banners', icon: ImageIcon },
      { label: 'Header Links', path: '/ui/header-links', icon: PanelTop },
      { label: 'Footer Links', path: '/ui/footer-links', icon: PanelBottom },
      { label: 'Catalog Setting', path: '/ui/catalog-settings', icon: Boxes },
      { label: 'Checkout Setting', path: '/ui/checkout-settings', icon: ShoppingCart },
      /*
       * Everything this shop connects to: courier accounts and marketing
       * integrations. Sits with the other settings editors rather than under
       * Sales beside the Courier page — that one reports account state, this one
       * decides what is connected and holds the credentials.
       *
       * Gated to OWNER/ADMIN by this section, matching the RoleGuard in
       * app-router.tsx — the two must be kept in step by hand. STAFF is excluded
       * on purpose here even though they dispatch parcels: changing which
       * account parcels go through, or what the shop's ad measurement reports,
       * is an owner-level decision.
       *
       * Renamed from "Courier Setting" at /ui/courier-settings, which now
       * redirects — see app-router.tsx.
       */
      { label: 'Integrations', path: '/ui/integrations', icon: Plug },
      /*
       * Directly above Site Setting, because that is where its fonts are
       * chosen: a merchant who opens the font pickers and finds the face they
       * want missing needs the library to be the next thing they see, not
       * somewhere else in the section.
       */
      { label: 'Fonts', path: '/ui/fonts', icon: Type },
      { label: 'Site Setting', path: '/ui/site-settings', icon: Globe },
    ],
  },
  {
    /*
     * Everything that decides how the shop appears in a search result, in one
     * place. It was previously spread across four screens and two that did not
     * exist: three fields at the bottom of Site Setting, per-record meta boxes
     * on Pages, Blog and Landing Pages, two columns on Product and Category that
     * no form ever rendered, and no way at all to reach robots, the sitemap or
     * structured data.
     *
     * A section of its own rather than another entry under UI: UI is about what
     * a visitor sees on the page, and this is about what a crawler reads off it.
     * The two are edited by the same person at different times, and the SEO
     * settings a merchant needs are not findable under "Palette".
     */
    label: 'SEO',
    icon: Search,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { label: 'General', path: '/seo/general', icon: SlidersHorizontal },
      { label: 'Indexing', path: '/seo/indexing', icon: Bot },
      { label: 'Structured Data', path: '/seo/structured-data', icon: Braces },
      { label: 'Verification', path: '/seo/verification', icon: BadgeCheck },
      /*
       * Last, and the only one that is a list rather than a settings form: it is
       * where a merchant goes once the global settings are right, to fix the
       * individual pages that are still missing a title or a description.
       */
      { label: 'Page SEO', path: '/seo/pages', icon: ListChecks },
    ],
  },
  {
    label: 'Customers',
    icon: Users,
    items: [
      { label: 'Customers', path: '/customers/customers', icon: Contact },
      { label: 'Reviews', path: '/customers/reviews', icon: Star },
    ],
  },
  {
    label: 'Support',
    icon: LifeBuoy,
    items: [{ label: 'Support Tickets', path: '/support/tickets', icon: Ticket }],
  },
  {
    label: 'Notifications',
    icon: Bell,
    path: '/notifications',
  },
  {
    label: 'Settings',
    icon: Settings,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { label: 'Store Settings', path: '/settings/store', icon: Store },
      { label: 'Roles & Permissions', path: '/settings/roles', icon: ShieldCheck, roles: ['OWNER'] },
      { label: 'Staff Users', path: '/settings/staff', icon: UserCog },
      { label: 'Audit Logs', path: '/settings/audit-logs', icon: ScrollText },
      { label: 'Storage', path: '/settings/storage', icon: HardDrive },
    ],
  },
]

export function isNavNodeVisible(roles: AdminRole[] | undefined, role: AdminRole) {
  return !roles || roles.includes(role)
}

/** Flattens the nav config into a role→allowed-path-prefix lookup used by the route guard. */
export function getVisiblePaths(role: AdminRole): string[] {
  const paths: string[] = []
  for (const section of NAV_SECTIONS) {
    if (!isNavNodeVisible(section.roles, role)) continue
    if (section.path) paths.push(section.path)
    for (const item of section.items ?? []) {
      if (!isNavNodeVisible(item.roles, role)) continue
      paths.push(item.path)
    }
  }
  return paths
}
