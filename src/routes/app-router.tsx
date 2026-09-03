import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
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
const SubCategoriesPage = lazy(() => import('@/features/catalog/sub-categories/sub-categories-page'))
const BrandsPage = lazy(() => import('@/features/catalog/brands/brands-page'))
const AttributesPage = lazy(() => import('@/features/catalog/attributes/attributes-page'))
const AttributeFormPage = lazy(() => import('@/features/catalog/attributes/attribute-form-page'))
const TaxRulesPage = lazy(() => import('@/features/catalog/tax-rules/tax-rules-page'))
const TaxRuleFormPage = lazy(() => import('@/features/catalog/tax-rules/tax-rule-form-page'))
const ShippingRulesPage = lazy(() => import('@/features/catalog/shipping-rules/shipping-rules-page'))
const ShippingRuleFormPage = lazy(
  () => import('@/features/catalog/shipping-rules/shipping-rule-form-page'),
)
const CollectionsPage = lazy(() => import('@/features/catalog/collections/collections-page'))
const CollectionFormPage = lazy(
  () => import('@/features/catalog/collections/collection-form-page'),
)
const BundleDealsPage = lazy(() => import('@/features/catalog/bundle-deals/bundle-deals-page'))
const BundleDealFormPage = lazy(
  () => import('@/features/catalog/bundle-deals/bundle-deal-form-page'),
)

const WarehousesPage = lazy(() => import('@/features/inventory/warehouses/warehouses-page'))
const StockPage = lazy(() => import('@/features/inventory/stock/stock-page'))
const StockMovementsPage = lazy(() => import('@/features/inventory/stock-movements/stock-movements-page'))
const SuppliersPage = lazy(() => import('@/features/inventory/suppliers/suppliers-page'))
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
const ReturnsPage = lazy(() => import('@/features/sales/returns/returns-page'))
const ReturnDetailPage = lazy(() => import('@/features/sales/returns/return-detail-page'))
const RefundsPage = lazy(() => import('@/features/sales/refunds/refunds-page'))
const ShippingMethodsPage = lazy(() => import('@/features/sales/shipping-methods/shipping-methods-page'))

const VouchersPage = lazy(() => import('@/features/marketing/vouchers/vouchers-page'))
const CampaignsListPage = lazy(() => import('@/features/marketing/campaigns/campaigns-list-page'))
const CampaignDetailPage = lazy(() => import('@/features/marketing/campaigns/campaign-detail-page'))
const BannersPage = lazy(() => import('@/features/marketing/banners/banners-page'))

const CustomersListPage = lazy(() => import('@/features/customers/customers/customers-list-page'))
const CustomerDetailPage = lazy(() => import('@/features/customers/customers/customer-detail-page'))
const ReviewsPage = lazy(() => import('@/features/customers/reviews/reviews-page'))

const SupportTicketsListPage = lazy(() => import('@/features/support/tickets/support-tickets-list-page'))
const SupportTicketDetailPage = lazy(() => import('@/features/support/tickets/support-ticket-detail-page'))
const NotificationsPage = lazy(() => import('@/features/support/notifications/notifications-page'))

const StoreSettingsPage = lazy(() => import('@/features/settings/store-settings/store-settings-page'))
const RolesPermissionsPage = lazy(() => import('@/features/settings/roles-permissions/roles-permissions-page'))
const StaffUsersPage = lazy(() => import('@/features/customers/staff-users/staff-users-page'))
const AuditLogsPage = lazy(() => import('@/features/settings/audit-logs/audit-logs-page'))

const NotFoundPage = lazy(() => import('@/routes/not-found-page'))

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
          <Route path="/catalog/sub-categories" element={<SubCategoriesPage />} />
          <Route path="/catalog/brands" element={<BrandsPage />} />

          {/* Each of these pairs a list with one form route serving both create
              and edit — the shared form page navigates from `/new` to `/:id`
              after the first save, so the two must be the same component. */}
          <Route path="/catalog/attributes" element={<AttributesPage />} />
          <Route path="/catalog/attributes/new" element={<AttributeFormPage />} />
          <Route path="/catalog/attributes/:attributeId" element={<AttributeFormPage />} />
          <Route path="/catalog/tax-rules" element={<TaxRulesPage />} />
          <Route path="/catalog/tax-rules/new" element={<TaxRuleFormPage />} />
          <Route path="/catalog/tax-rules/:taxRuleId" element={<TaxRuleFormPage />} />
          <Route path="/catalog/shipping-rules" element={<ShippingRulesPage />} />
          <Route path="/catalog/shipping-rules/new" element={<ShippingRuleFormPage />} />
          <Route path="/catalog/shipping-rules/:shippingRuleId" element={<ShippingRuleFormPage />} />
          <Route path="/catalog/collections" element={<CollectionsPage />} />
          <Route path="/catalog/collections/new" element={<CollectionFormPage />} />
          <Route path="/catalog/collections/:collectionId" element={<CollectionFormPage />} />
          <Route path="/catalog/bundle-deals" element={<BundleDealsPage />} />
          <Route path="/catalog/bundle-deals/new" element={<BundleDealFormPage />} />
          <Route path="/catalog/bundle-deals/:bundleDealId" element={<BundleDealFormPage />} />

          <Route path="/inventory/warehouses" element={<WarehousesPage />} />
          <Route path="/inventory/stock" element={<StockPage />} />
          <Route path="/inventory/stock-movements" element={<StockMovementsPage />} />
          <Route path="/inventory/suppliers" element={<SuppliersPage />} />
          <Route path="/inventory/purchase-orders" element={<PurchaseOrdersListPage />} />
          <Route path="/inventory/purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/inventory/purchase-orders/:poId" element={<PurchaseOrderDetailPage />} />
          <Route path="/inventory/purchase-orders/:poId/edit" element={<PurchaseOrderFormPage />} />

          <Route path="/sales/orders" element={<OrdersListPage />} />
          <Route path="/sales/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/sales/returns" element={<ReturnsPage />} />
          <Route path="/sales/returns/:returnId" element={<ReturnDetailPage />} />
          <Route path="/sales/refunds" element={<RefundsPage />} />
          <Route path="/sales/shipping-methods" element={<ShippingMethodsPage />} />

          <Route path="/marketing/vouchers" element={<VouchersPage />} />
          {/* Coupons were renamed Vouchers — the record is unchanged, so an
              existing bookmark should land on it rather than on Not Found. */}
          <Route
            path="/marketing/coupons"
            element={<Navigate to="/marketing/vouchers" replace />}
          />
          <Route path="/marketing/campaigns" element={<CampaignsListPage />} />
          <Route path="/marketing/campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="/marketing/banners" element={<BannersPage />} />

          <Route path="/customers/customers" element={<CustomersListPage />} />
          <Route path="/customers/customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="/customers/reviews" element={<ReviewsPage />} />

          <Route path="/support/tickets" element={<SupportTicketsListPage />} />
          <Route path="/support/tickets/:ticketId" element={<SupportTicketDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route element={<RoleGuard roles={['OWNER', 'ADMIN']} />}>
            <Route path="/settings/store" element={<StoreSettingsPage />} />
            <Route path="/settings/staff" element={<StaffUsersPage />} />
            <Route path="/settings/audit-logs" element={<AuditLogsPage />} />
          </Route>
          <Route element={<RoleGuard roles={['OWNER']} />}>
            <Route path="/settings/roles" element={<RolesPermissionsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
