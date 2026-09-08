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
  Layers,
  PackagePlus,
  TicketPercent,
  ShoppingBag,
  Boxes,
  ArrowLeftRight,
  Factory,
  ClipboardList,
  ReceiptText,
  Undo2,
  Banknote,
  Truck,
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
    label: 'Catalog',
    icon: Package,
    /*
     * Ordered the way a merchant builds a catalogue rather than
     * alphabetically: the things a product refers to come first, and Products
     * last, because authoring one is easier once its category, brand,
     * attributes and rules already exist. This is the grouping the reference
     * panel uses, for the same reason.
     */
    items: [
      { label: 'Categories', path: '/catalog/categories', icon: FolderTree },
      { label: 'Sub categories', path: '/catalog/sub-categories', icon: FolderOpen },
      { label: 'Brands', path: '/catalog/brands', icon: Tag },
      { label: 'Attributes', path: '/catalog/attributes', icon: SlidersHorizontal },
      { label: 'Tax rules', path: '/catalog/tax-rules', icon: Percent },
      { label: 'Collections', path: '/catalog/collections', icon: Layers },
      { label: 'Bundle deals', path: '/catalog/bundle-deals', icon: PackagePlus },
      { label: 'Vouchers', path: '/marketing/vouchers', icon: TicketPercent },
      { label: 'Products', path: '/catalog/products', icon: ShoppingBag },
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
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { label: 'Orders', path: '/sales/orders', icon: ReceiptText },
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
      { label: 'Home Slider', path: '/ui/home-slider', icon: GalleryHorizontal },
      { label: 'Banners', path: '/ui/banners', icon: ImageIcon },
      { label: 'Header Links', path: '/ui/header-links', icon: PanelTop },
      { label: 'Footer Links', path: '/ui/footer-links', icon: PanelBottom },
      { label: 'Catalog Setting', path: '/ui/catalog-settings', icon: Boxes },
      { label: 'Checkout Setting', path: '/ui/checkout-settings', icon: ShoppingCart },
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
