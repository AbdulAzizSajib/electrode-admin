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
  type LucideIcon,
} from 'lucide-react'
import type { AdminRole } from '@/lib/store/session-store'

export interface NavLinkItem {
  label: string
  path: string
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
    items: [
      { label: 'Products', path: '/catalog/products' },
      { label: 'Categories', path: '/catalog/categories' },
      { label: 'Brands', path: '/catalog/brands' },
    ],
  },
  {
    label: 'Inventory',
    icon: Warehouse,
    items: [
      { label: 'Warehouses', path: '/inventory/warehouses' },
      { label: 'Stock', path: '/inventory/stock' },
      { label: 'Stock Movements', path: '/inventory/stock-movements' },
      { label: 'Suppliers', path: '/inventory/suppliers' },
      { label: 'Purchase Orders', path: '/inventory/purchase-orders' },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { label: 'Orders', path: '/sales/orders' },
      { label: 'Returns', path: '/sales/returns' },
      { label: 'Refunds', path: '/sales/refunds' },
      { label: 'Shipping Methods', path: '/sales/shipping-methods' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Coupons', path: '/marketing/coupons' },
      { label: 'Campaigns', path: '/marketing/campaigns' },
      { label: 'Banners', path: '/marketing/banners' },
    ],
  },
  {
    label: 'Customers',
    icon: Users,
    items: [
      { label: 'Customers', path: '/customers/customers' },
      { label: 'Reviews', path: '/customers/reviews' },
    ],
  },
  {
    label: 'Support',
    icon: LifeBuoy,
    items: [{ label: 'Support Tickets', path: '/support/tickets' }],
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
      { label: 'Store Settings', path: '/settings/store' },
      { label: 'Roles & Permissions', path: '/settings/roles', roles: ['OWNER'] },
      { label: 'Staff Users', path: '/settings/staff' },
      { label: 'Audit Logs', path: '/settings/audit-logs' },
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
