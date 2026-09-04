import {
  LayoutDashboard,
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
  Route,
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
  FileText,
  GalleryHorizontal,
  PanelTop,
  PanelBottom,
  Globe,
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
      { label: 'Shipping rules', path: '/catalog/shipping-rules', icon: Route },
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
      { label: 'Pages', path: '/ui/pages', icon: FileText },
      { label: 'Home Slider', path: '/ui/home-slider', icon: GalleryHorizontal },
      { label: 'Banners', path: '/ui/banners', icon: ImageIcon },
      { label: 'Header Links', path: '/ui/header-links', icon: PanelTop },
      { label: 'Footer Links', path: '/ui/footer-links', icon: PanelBottom },
      { label: 'Checkout Setting', path: '/ui/checkout-settings', icon: ShoppingCart },
      { label: 'Site Setting', path: '/ui/site-settings', icon: Globe },
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
