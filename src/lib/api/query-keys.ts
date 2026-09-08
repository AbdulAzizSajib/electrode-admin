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

  attributes: { all: ['attributes'] as const, list: (p?: object) => ['attributes', 'list', p] as const, detail: (id: string) => ['attributes', 'detail', id] as const },
  taxRules: { all: ['tax-rules'] as const, list: (p?: object) => ['tax-rules', 'list', p] as const, detail: (id: string) => ['tax-rules', 'detail', id] as const },
  collections: { all: ['collections'] as const, list: (p?: object) => ['collections', 'list', p] as const, detail: (id: string) => ['collections', 'detail', id] as const },
  bundleDeals: { all: ['bundle-deals'] as const, list: (p?: object) => ['bundle-deals', 'list', p] as const, detail: (id: string) => ['bundle-deals', 'detail', id] as const },
  // `search` is keyed by term rather than by a params object: the autocomplete
  // asks per keystroke and each term is its own cacheable answer.
  tags: { all: ['tags'] as const, list: (p?: object) => ['tags', 'list', p] as const, search: (term: string) => ['tags', 'search', term] as const },

  warehouses: { all: ['warehouses'] as const, list: (p?: object) => ['warehouses', 'list', p] as const, detail: (id: string) => ['warehouses', 'detail', id] as const },
  stock: { all: ['stock'] as const, list: (p?: object) => ['stock', 'list', p] as const },
  stockMovements: { all: ['stock-movements'] as const, list: (p?: object) => ['stock-movements', 'list', p] as const },
  suppliers: { all: ['suppliers'] as const, list: (p?: object) => ['suppliers', 'list', p] as const, detail: (id: string) => ['suppliers', 'detail', id] as const },
  purchaseOrders: { all: ['purchase-orders'] as const, list: (p?: object) => ['purchase-orders', 'list', p] as const, detail: (id: string) => ['purchase-orders', 'detail', id] as const },
  supplierPayments: { all: ['supplier-payments'] as const, byPurchaseOrder: (purchaseOrderId: string) => ['supplier-payments', 'by-purchase-order', purchaseOrderId] as const },

  orders: { all: ['orders'] as const, list: (p?: object) => ['orders', 'list', p] as const, detail: (id: string) => ['orders', 'detail', id] as const },
  payments: { byOrder: (orderId: string) => ['payments', 'by-order', orderId] as const },
  shipments: { byOrder: (orderId: string) => ['shipments', 'by-order', orderId] as const },
  returns: { all: ['returns'] as const, list: (p?: object) => ['returns', 'list', p] as const, detail: (id: string) => ['returns', 'detail', id] as const },
  refunds: { all: ['refunds'] as const, list: (p?: object) => ['refunds', 'list', p] as const, detail: (id: string) => ['refunds', 'detail', id] as const },

  coupons: { all: ['coupons'] as const, list: (p?: object) => ['coupons', 'list', p] as const, detail: (id: string) => ['coupons', 'detail', id] as const },
  campaigns: { all: ['campaigns'] as const, list: (p?: object) => ['campaigns', 'list', p] as const, detail: (id: string) => ['campaigns', 'detail', id] as const },
  banners: { all: ['banners'] as const, list: (p?: object) => ['banners', 'list', p] as const, detail: (id: string) => ['banners', 'detail', id] as const },
  pages: {
    all: ['pages'] as const,
    list: (p?: object) => ['pages', 'list', p] as const,
    detail: (id: string) => ['pages', 'detail', id] as const,
    // Under `pages` so a page mutation's blanket invalidation refreshes the
    // published list the link pickers read.
    published: ['pages', 'published'] as const,
    reservedSlugs: ['pages', 'reserved-slugs'] as const,
  },

  // The two homepage sections a merchant owns. Beside `pages` rather than under
  // it: all three are storefront content, and none nests inside another.
  blogPosts: {
    all: ['blog-posts'] as const,
    list: (p?: object) => ['blog-posts', 'list', p] as const,
    detail: (id: string) => ['blog-posts', 'detail', id] as const,
  },
  testimonials: {
    all: ['testimonials'] as const,
    list: (p?: object) => ['testimonials', 'list', p] as const,
    detail: (id: string) => ['testimonials', 'detail', id] as const,
  },

  /**
   * `published` is its own key rather than a filtered `list`: it feeds the
   * active-page selector, which must not be invalidated or refetched by the
   * paging and searching the list page does.
   */
  landingPages: {
    all: ['landing-pages'] as const,
    list: (p?: object) => ['landing-pages', 'list', p] as const,
    detail: (id: string) => ['landing-pages', 'detail', id] as const,
    published: ['landing-pages', 'published'] as const,
  },

  customers: { all: ['customers'] as const, list: (p?: object) => ['customers', 'list', p] as const, detail: (id: string) => ['customers', 'detail', id] as const },
  staffUsers: { all: ['staff-users'] as const, list: (p?: object) => ['staff-users', 'list', p] as const, detail: (id: string) => ['staff-users', 'detail', id] as const },
  reviews: { all: ['reviews'] as const, list: (p?: object) => ['reviews', 'list', p] as const },

  supportTickets: { all: ['support-tickets'] as const, list: (p?: object) => ['support-tickets', 'list', p] as const, detail: (id: string) => ['support-tickets', 'detail', id] as const, messages: (id: string) => ['support-tickets', 'messages', id] as const },
  notifications: { all: ['notifications'] as const, list: (p?: object) => ['notifications', 'list', p] as const, unreadCount: ['notifications', 'unread-count'] as const },

  storeSettings: { detail: ['store-settings'] as const },
  /*
   * The unauthenticated branding read used by the auth screens. Its own key
   * rather than a slice of `storeSettings`: the two come from different
   * endpoints with different auth, and they are cached across different
   * sessions — this one is fetched while logged OUT and must not be dropped or
   * refetched by the invalidation a settings save fires.
   */
  publicBranding: { detail: ['public-branding'] as const },
  /*
   * The cross-content SEO overview. Separate from `storeSettings` because it
   * reads five content tables rather than the settings row — saving an SEO
   * screen must not invalidate a list whose contents it did not change, and
   * editing a product's meta title must not refetch the settings row.
   */
  seo: {
    all: ['seo'] as const,
    overview: (p?: object) => ['seo', 'overview', p] as const,
  },
  roles: { all: ['roles'] as const, list: (p?: object) => ['roles', 'list', p] as const, detail: (id: string) => ['roles', 'detail', id] as const },
  permissions: { all: ['permissions'] as const, list: (p?: object) => ['permissions', 'list', p] as const },
  auditLogs: { all: ['audit-logs'] as const, list: (p?: object) => ['audit-logs', 'list', p] as const },

  /**
   * The shared live poll. Not under `dashboard` because it outlives any one page — the pending
   * badge and notification count read it from the app shell — and because invalidating
   * `['dashboard']` on a detected change must not also invalidate the probe that detected it.
   */
  pulse: ['pulse'] as const,

  dashboard: {
    all: ['dashboard'] as const,
    summary: (range: string) => ['dashboard', 'summary', range] as const,
    topProducts: (range: string) => ['dashboard', 'top-products', range] as const,
  },

  /**
   * One `all` covering every report, so a mutation anywhere that moves money
   * or stock can invalidate the lot without listing five keys. Each report is
   * keyed by its own params object because two filter sets are two different
   * answers, not two views of one.
   */
  reports: {
    all: ['reports'] as const,
    stock: (p?: object) => ['reports', 'stock', p] as const,
    stockHistory: (p?: object) => ['reports', 'stock-history', p] as const,
    sales: (p?: object) => ['reports', 'sales', p] as const,
    purchases: (p?: object) => ['reports', 'purchases', p] as const,
    payments: (p?: object) => ['reports', 'payments', p] as const,
  },
}
