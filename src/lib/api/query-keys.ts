/** Central query-key factory so every resource's cache keys stay consistent and typo-free. */
export const queryKeys = {
  categories: {
    all: ['categories'] as const,
    list: (p?: object) => ['categories', 'list', p] as const,
    detail: (id: string) => ['categories', 'detail', id] as const,
    tree: ['categories', 'tree'] as const,
  },
  brands: { all: ['brands'] as const, list: (p?: object) => ['brands', 'list', p] as const, detail: (id: string) => ['brands', 'detail', id] as const },
  products: { all: ['products'] as const, list: (p?: object) => ['products', 'list', p] as const, detail: (id: string) => ['products', 'detail', id] as const },

  warehouses: { all: ['warehouses'] as const, list: (p?: object) => ['warehouses', 'list', p] as const, detail: (id: string) => ['warehouses', 'detail', id] as const },
  stock: { all: ['stock'] as const, list: (p?: object) => ['stock', 'list', p] as const },
  stockMovements: { all: ['stock-movements'] as const, list: (p?: object) => ['stock-movements', 'list', p] as const },
  suppliers: { all: ['suppliers'] as const, list: (p?: object) => ['suppliers', 'list', p] as const, detail: (id: string) => ['suppliers', 'detail', id] as const },
  purchaseOrders: { all: ['purchase-orders'] as const, list: (p?: object) => ['purchase-orders', 'list', p] as const, detail: (id: string) => ['purchase-orders', 'detail', id] as const },

  orders: { all: ['orders'] as const, list: (p?: object) => ['orders', 'list', p] as const, detail: (id: string) => ['orders', 'detail', id] as const },
  payments: { byOrder: (orderId: string) => ['payments', 'by-order', orderId] as const },
  shipments: { byOrder: (orderId: string) => ['shipments', 'by-order', orderId] as const },
  returns: { all: ['returns'] as const, list: (p?: object) => ['returns', 'list', p] as const, detail: (id: string) => ['returns', 'detail', id] as const },
  refunds: { all: ['refunds'] as const, list: (p?: object) => ['refunds', 'list', p] as const, detail: (id: string) => ['refunds', 'detail', id] as const },
  shippingMethods: { all: ['shipping-methods'] as const, list: (p?: object) => ['shipping-methods', 'list', p] as const },

  coupons: { all: ['coupons'] as const, list: (p?: object) => ['coupons', 'list', p] as const, detail: (id: string) => ['coupons', 'detail', id] as const },
  campaigns: { all: ['campaigns'] as const, list: (p?: object) => ['campaigns', 'list', p] as const, detail: (id: string) => ['campaigns', 'detail', id] as const },
  banners: { all: ['banners'] as const, list: (p?: object) => ['banners', 'list', p] as const, detail: (id: string) => ['banners', 'detail', id] as const },

  customers: { all: ['customers'] as const, list: (p?: object) => ['customers', 'list', p] as const, detail: (id: string) => ['customers', 'detail', id] as const },
  staffUsers: { all: ['staff-users'] as const, list: (p?: object) => ['staff-users', 'list', p] as const },
  reviews: { all: ['reviews'] as const, list: (p?: object) => ['reviews', 'list', p] as const },

  supportTickets: { all: ['support-tickets'] as const, list: (p?: object) => ['support-tickets', 'list', p] as const, detail: (id: string) => ['support-tickets', 'detail', id] as const },
  notifications: { all: ['notifications'] as const, list: (p?: object) => ['notifications', 'list', p] as const, unreadCount: ['notifications', 'unread-count'] as const },

  storeSettings: { detail: ['store-settings'] as const },
  roles: { all: ['roles'] as const, list: (p?: object) => ['roles', 'list', p] as const, detail: (id: string) => ['roles', 'detail', id] as const },
  permissions: { all: ['permissions'] as const, list: (p?: object) => ['permissions', 'list', p] as const },
  auditLogs: { all: ['audit-logs'] as const, list: (p?: object) => ['audit-logs', 'list', p] as const },

  dashboard: { summary: (range: string) => ['dashboard', 'summary', range] as const },
}
