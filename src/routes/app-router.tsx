import { lazy } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router'
import { ShellLayout } from '@/components/layout/shell-layout'
import { AuthLayout } from '@/components/layout/auth-layout'
import { AuthGuard, GuestGuard, RoleGuard } from '@/routes/guards'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page'))

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))

const ProductsListPage = lazy(() => import('@/features/catalog/products/products-list-page'))
const ProductFormPage = lazy(() => import('@/features/catalog/products/product-form-page'))
const ProductDetailPage = lazy(() => import('@/features/catalog/products/product-detail-page'))
const CategoriesPage = lazy(() => import('@/features/catalog/categories/categories-page'))
const CategoryFormPage = lazy(() => import('@/features/catalog/categories/category-form-page'))
const SubCategoriesPage = lazy(() => import('@/features/catalog/sub-categories/sub-categories-page'))
const BrandsPage = lazy(() => import('@/features/catalog/brands/brands-page'))
const BrandFormPage = lazy(() => import('@/features/catalog/brands/brand-form-page'))
const BrandBulkCreatePage = lazy(() => import('@/features/catalog/brands/brand-bulk-create-page'))
const AttributesPage = lazy(() => import('@/features/catalog/attributes/attributes-page'))
const AttributeFormPage = lazy(() => import('@/features/catalog/attributes/attribute-form-page'))
const TaxRulesPage = lazy(() => import('@/features/catalog/tax-rules/tax-rules-page'))
const TaxRuleFormPage = lazy(() => import('@/features/catalog/tax-rules/tax-rule-form-page'))
const CollectionsPage = lazy(() => import('@/features/catalog/collections/collections-page'))
const CollectionFormPage = lazy(
  () => import('@/features/catalog/collections/collection-form-page'),
)
const BundleDealsPage = lazy(() => import('@/features/catalog/bundle-deals/bundle-deals-page'))
const BundleDealFormPage = lazy(
  () => import('@/features/catalog/bundle-deals/bundle-deal-form-page'),
)

const WarehousesPage = lazy(() => import('@/features/inventory/warehouses/warehouses-page'))
const WarehouseFormPage = lazy(() => import('@/features/inventory/warehouses/warehouse-form-page'))
const StockPage = lazy(() => import('@/features/inventory/stock/stock-page'))
const StockMovementsPage = lazy(() => import('@/features/inventory/stock-movements/stock-movements-page'))
const SuppliersPage = lazy(() => import('@/features/inventory/suppliers/suppliers-page'))
const SupplierFormPage = lazy(() => import('@/features/inventory/suppliers/supplier-form-page'))
const PurchaseOrdersListPage = lazy(
  () => import('@/features/inventory/purchase-orders/purchase-orders-list-page'),
)
const PurchaseOrderFormPage = lazy(
  () => import('@/features/inventory/purchase-orders/purchase-order-form-page'),
)
const PurchaseOrderDetailPage = lazy(
  () => import('@/features/inventory/purchase-orders/purchase-order-detail-page'),
)

const OrdersListPage = lazy(() => import('@/features/sales/orders/orders-list-page'))
const OrderDetailPage = lazy(() => import('@/features/sales/orders/order-detail-page'))
const OrderDocumentPage = lazy(
  () => import('@/features/sales/orders/documents/order-document-page'),
)
const ReturnsPage = lazy(() => import('@/features/sales/returns/returns-page'))
const ReturnDetailPage = lazy(() => import('@/features/sales/returns/return-detail-page'))
const RefundsPage = lazy(() => import('@/features/sales/refunds/refunds-page'))

const StockReportPage = lazy(() => import('@/features/reports/stock/stock-report-page'))
const SalesReportPage = lazy(() => import('@/features/reports/sales/sales-report-page'))
const PurchasesReportPage = lazy(() => import('@/features/reports/purchases/purchases-report-page'))
const StockHistoryReportPage = lazy(
  () => import('@/features/reports/stock-history/stock-history-report-page'),
)
const PaymentHistoryPage = lazy(() => import('@/features/reports/payments/payment-history-page'))

const VouchersPage = lazy(() => import('@/features/marketing/vouchers/vouchers-page'))
const VoucherFormPage = lazy(() => import('@/features/marketing/vouchers/voucher-form-page'))
const CampaignsListPage = lazy(() => import('@/features/marketing/campaigns/campaigns-list-page'))
const CampaignFormPage = lazy(() => import('@/features/marketing/campaigns/campaign-form-page'))
const CampaignDetailPage = lazy(() => import('@/features/marketing/campaigns/campaign-detail-page'))
const BannersPage = lazy(() => import('@/features/ui/banners/banners-page'))
const BannerFormPage = lazy(() => import('@/features/ui/banners/banner-form-page'))
const PagesListPage = lazy(() => import('@/features/ui/pages/pages-list-page'))
const PageFormPage = lazy(() => import('@/features/ui/pages/page-form-page'))
const BlogListPage = lazy(() => import('@/features/ui/blog/blog-list-page'))
const BlogFormPage = lazy(() => import('@/features/ui/blog/blog-form-page'))
const TestimonialsListPage = lazy(
  () => import('@/features/ui/testimonials/testimonials-list-page'),
)
const TestimonialFormPage = lazy(
  () => import('@/features/ui/testimonials/testimonial-form-page'),
)
const LandingPagesListPage = lazy(
  () => import('@/features/ui/landing-pages/landing-pages-page'),
)
const LandingPageFormPage = lazy(
  () => import('@/features/ui/landing-pages/landing-page-form-page'),
)
const HomeSliderPage = lazy(() => import('@/features/ui/home-slider/home-slider-page'))
const HeaderLinksPage = lazy(() => import('@/features/ui/header-links/header-links-page'))
const FooterLinksPage = lazy(() => import('@/features/ui/footer-links/footer-links-page'))
const CatalogSettingsPage = lazy(
  () => import('@/features/ui/catalog-settings/catalog-settings-page'),
)
const CheckoutSettingsPage = lazy(
  () => import('@/features/ui/checkout-settings/checkout-settings-page'),
)
const SiteSettingsPage = lazy(() => import('@/features/ui/site-settings/site-settings-page'))
const SeoGeneralPage = lazy(() => import('@/features/seo/general/seo-general-page'))
const SeoIndexingPage = lazy(() => import('@/features/seo/indexing/seo-indexing-page'))
const SeoStructuredDataPage = lazy(
  () => import('@/features/seo/structured-data/seo-structured-data-page'),
)
const SeoVerificationPage = lazy(
  () => import('@/features/seo/verification/seo-verification-page'),
)
const PageSeoPage = lazy(() => import('@/features/seo/page-seo/page-seo-page'))

const CustomersListPage = lazy(() => import('@/features/customers/customers/customers-list-page'))
const CustomerDetailPage = lazy(() => import('@/features/customers/customers/customer-detail-page'))
const ReviewsPage = lazy(() => import('@/features/customers/reviews/reviews-page'))

const SupportTicketsListPage = lazy(() => import('@/features/support/tickets/support-tickets-list-page'))
const SupportTicketDetailPage = lazy(() => import('@/features/support/tickets/support-ticket-detail-page'))
const NotificationsPage = lazy(() => import('@/features/support/notifications/notifications-page'))

const StoreSettingsPage = lazy(() => import('@/features/settings/store-settings/store-settings-page'))
const RolesPermissionsPage = lazy(() => import('@/features/settings/roles-permissions/roles-permissions-page'))
const StaffUsersPage = lazy(() => import('@/features/customers/staff-users/staff-users-page'))
const StaffUserFormPage = lazy(
  () => import('@/features/customers/staff-users/staff-user-form-page'),
)
const RoleFormPage = lazy(() => import('@/features/settings/roles-permissions/role-form-page'))
const AuditLogsPage = lazy(() => import('@/features/settings/audit-logs/audit-logs-page'))

const NotFoundPage = lazy(() => import('@/routes/not-found-page'))

/**
 * `<Navigate to="/ui/banners/:bannerId">` would navigate to the literal string
 * ":bannerId" — the target is not a pattern. So the id is read off the current
 * match and substituted, which is what keeps a bookmarked edit link pointing at
 * the same banner after the move out of Marketing.
 */
function RedirectToUiBanner() {
  const { bannerId } = useParams()
  return <Navigate to={`/ui/banners/${bannerId}`} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<GuestGuard />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Route>

      <Route element={<AuthGuard />}>
        <Route element={<ShellLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/catalog/products" element={<ProductsListPage />} />
          <Route path="/catalog/products/new" element={<ProductFormPage />} />
          <Route path="/catalog/products/:productId" element={<ProductDetailPage />} />
          <Route path="/catalog/products/:productId/edit" element={<ProductFormPage />} />
          <Route path="/catalog/categories" element={<CategoriesPage />} />
          <Route path="/catalog/categories/new" element={<CategoryFormPage />} />
          <Route path="/catalog/categories/:categoryId" element={<CategoryFormPage />} />
          {/* The same form, mounted under the sub-categories path so Cancel and
              save-and-return land on the list the merchant came from. */}
          <Route path="/catalog/sub-categories" element={<SubCategoriesPage />} />
          <Route path="/catalog/sub-categories/new" element={<CategoryFormPage />} />
          <Route path="/catalog/sub-categories/:categoryId" element={<CategoryFormPage />} />
          <Route path="/catalog/brands" element={<BrandsPage />} />
          {/* `/bulk` and `/new` are static, so they win over `/:brandId` regardless
              of order; declared first so reading the file matches that. */}
          <Route path="/catalog/brands/bulk" element={<BrandBulkCreatePage />} />
          <Route path="/catalog/brands/new" element={<BrandFormPage />} />
          <Route path="/catalog/brands/:brandId" element={<BrandFormPage />} />

          {/* Each of these pairs a list with one form route serving both create
              and edit — the shared form page navigates from `/new` to `/:id`
              after the first save, so the two must be the same component. */}
          <Route path="/catalog/attributes" element={<AttributesPage />} />
          <Route path="/catalog/attributes/new" element={<AttributeFormPage />} />
          <Route path="/catalog/attributes/:attributeId" element={<AttributeFormPage />} />
          <Route path="/catalog/tax-rules" element={<TaxRulesPage />} />
          <Route path="/catalog/tax-rules/new" element={<TaxRuleFormPage />} />
          <Route path="/catalog/tax-rules/:taxRuleId" element={<TaxRuleFormPage />} />
          <Route path="/catalog/collections" element={<CollectionsPage />} />
          <Route path="/catalog/collections/new" element={<CollectionFormPage />} />
          <Route path="/catalog/collections/:collectionId" element={<CollectionFormPage />} />
          <Route path="/catalog/bundle-deals" element={<BundleDealsPage />} />
          <Route path="/catalog/bundle-deals/new" element={<BundleDealFormPage />} />
          <Route path="/catalog/bundle-deals/:bundleDealId" element={<BundleDealFormPage />} />

          <Route path="/inventory/warehouses" element={<WarehousesPage />} />
          <Route path="/inventory/warehouses/new" element={<WarehouseFormPage />} />
          <Route path="/inventory/warehouses/:warehouseId" element={<WarehouseFormPage />} />
          <Route path="/inventory/stock" element={<StockPage />} />
          <Route path="/inventory/stock-movements" element={<StockMovementsPage />} />
          {/* Create and edit share one component — the shared form page navigates
              from `/new` to `/:id` after the first save, so a split would remount
              the form mid-edit. */}
          <Route path="/inventory/suppliers" element={<SuppliersPage />} />
          <Route path="/inventory/suppliers/new" element={<SupplierFormPage />} />
          <Route path="/inventory/suppliers/:supplierId" element={<SupplierFormPage />} />
          <Route path="/inventory/purchase-orders" element={<PurchaseOrdersListPage />} />
          <Route path="/inventory/purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/inventory/purchase-orders/:poId" element={<PurchaseOrderDetailPage />} />
          <Route path="/inventory/purchase-orders/:poId/edit" element={<PurchaseOrderFormPage />} />

          <Route path="/sales/orders" element={<OrdersListPage />} />
          <Route path="/sales/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/sales/returns" element={<ReturnsPage />} />
          <Route path="/sales/returns/:returnId" element={<ReturnDetailPage />} />
          <Route path="/sales/refunds" element={<RefundsPage />} />

          <Route path="/reports/stock" element={<StockReportPage />} />
          <Route path="/reports/sales" element={<SalesReportPage />} />
          <Route path="/reports/purchases" element={<PurchasesReportPage />} />
          <Route path="/reports/stock-history" element={<StockHistoryReportPage />} />
          <Route path="/reports/payments" element={<PaymentHistoryPage />} />
          <Route path="/marketing/vouchers" element={<VouchersPage />} />
          <Route path="/marketing/vouchers/new" element={<VoucherFormPage />} />
          <Route path="/marketing/vouchers/:voucherId" element={<VoucherFormPage />} />
          {/* Coupons were renamed Vouchers — the record is unchanged, so an
              existing bookmark should land on it rather than on Not Found. */}
          <Route
            path="/marketing/coupons"
            element={<Navigate to="/marketing/vouchers" replace />}
          />
          <Route path="/marketing/campaigns" element={<CampaignsListPage />} />
          {/* No edit route: a campaign is edited in place on its detail page,
              which is where its products are attached. */}
          <Route path="/marketing/campaigns/new" element={<CampaignFormPage />} />
          <Route path="/marketing/campaigns/:campaignId" element={<CampaignDetailPage />} />
          {/* Banners moved under UI. An existing bookmark — or the reference
              panel's muscle memory — should land on the record, not on Not
              Found. Same treatment coupons got when they became vouchers. */}
          <Route path="/marketing/banners" element={<Navigate to="/ui/banners" replace />} />
          <Route
            path="/marketing/banners/new"
            element={<Navigate to="/ui/banners/new" replace />}
          />
          <Route
            path="/marketing/banners/:bannerId"
            element={<RedirectToUiBanner />}
          />

          {/* Storefront chrome. Guarded as a block: every surface here rewrites
              what a shopper sees on every page, so none of it should be
              reachable by URL to a non-admin staff account. */}
          <Route element={<RoleGuard roles={['OWNER', 'ADMIN']} />}>
            <Route path="/ui/pages" element={<PagesListPage />} />
            <Route path="/ui/pages/new" element={<PageFormPage />} />
            <Route path="/ui/pages/:pageId" element={<PageFormPage />} />
            <Route path="/ui/blog" element={<BlogListPage />} />
            <Route path="/ui/blog/new" element={<BlogFormPage />} />
            <Route path="/ui/blog/:postId" element={<BlogFormPage />} />
            <Route path="/ui/testimonials" element={<TestimonialsListPage />} />
            <Route path="/ui/testimonials/new" element={<TestimonialFormPage />} />
            <Route path="/ui/testimonials/:testimonialId" element={<TestimonialFormPage />} />
            <Route path="/ui/landing-pages" element={<LandingPagesListPage />} />
            <Route path="/ui/landing-pages/new" element={<LandingPageFormPage />} />
            <Route path="/ui/landing-pages/:landingPageId" element={<LandingPageFormPage />} />
            <Route path="/ui/home-slider" element={<HomeSliderPage />} />
            <Route path="/ui/banners" element={<BannersPage />} />
            <Route path="/ui/banners/new" element={<BannerFormPage />} />
            <Route path="/ui/banners/:bannerId" element={<BannerFormPage />} />
            <Route path="/ui/header-links" element={<HeaderLinksPage />} />
            <Route path="/ui/footer-links" element={<FooterLinksPage />} />
            <Route path="/ui/catalog-settings" element={<CatalogSettingsPage />} />
            <Route path="/ui/checkout-settings" element={<CheckoutSettingsPage />} />
            <Route path="/ui/site-settings" element={<SiteSettingsPage />} />

            {/* SEO. Inside the same OWNER/ADMIN guard as the UI screens — these
                decide whether the shop is findable at all, which is not a staff
                decision. Kept in step with the `roles` on the SEO section in
                nav-config.ts by hand; nothing enforces that they agree. */}
            <Route path="/seo/general" element={<SeoGeneralPage />} />
            <Route path="/seo/indexing" element={<SeoIndexingPage />} />
            <Route path="/seo/structured-data" element={<SeoStructuredDataPage />} />
            <Route path="/seo/verification" element={<SeoVerificationPage />} />
            <Route path="/seo/pages" element={<PageSeoPage />} />
          </Route>

          <Route path="/customers/customers" element={<CustomersListPage />} />
          <Route path="/customers/customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="/customers/reviews" element={<ReviewsPage />} />

          <Route path="/support/tickets" element={<SupportTicketsListPage />} />
          <Route path="/support/tickets/:ticketId" element={<SupportTicketDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* The authoring pages sit inside the same guard as the list they were
              extracted from. Left outside, `/settings/staff/:userId` would be
              reachable by URL to anyone signed in — the dialog it replaced
              inherited the check by being rendered inside the guarded page. */}
          <Route element={<RoleGuard roles={['OWNER', 'ADMIN']} />}>
            <Route path="/settings/store" element={<StoreSettingsPage />} />
            <Route path="/settings/staff" element={<StaffUsersPage />} />
            <Route path="/settings/staff/:userId" element={<StaffUserFormPage />} />
            <Route path="/settings/audit-logs" element={<AuditLogsPage />} />
          </Route>
          <Route element={<RoleGuard roles={['OWNER']} />}>
            <Route path="/settings/roles" element={<RolesPermissionsPage />} />
            <Route path="/settings/roles/new" element={<RoleFormPage />} />
            <Route path="/settings/roles/:roleId" element={<RoleFormPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Fulfilment documents: signed in, but OUTSIDE ShellLayout.
            That placement is the feature — a printed packing slip or label must
            carry no sidebar, topbar or breadcrumbs, and hiding them with
            `@media print` from inside the shell still leaves every ancestor's
            layout participating in the printed page. Reached from an order, so
            deliberately absent from nav-config.ts.
            See openspec/changes/add-order-fulfillment-documents design.md
            Decision 3. */}
        <Route
          path="/sales/orders/:orderId/print/:document"
          element={<OrderDocumentPage />}
        />
      </Route>
    </Routes>
  )
}
