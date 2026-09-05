/**
 * Real backend report calls — the five pages under the admin's Report menu.
 *
 * Separate from `dashboard.ts` for the same reason `/reports` is separate from
 * `/analytics` on the server: the dashboard answers six fixed questions over a
 * `7d | 30d | 90d` window and returns chart-ready aggregates; these take an
 * arbitrary date range, many filters, paging, and export.
 *
 * Every report returns the same envelope — `{ range, summary, rows, meta }` —
 * with `summary` computed over the WHOLE filtered result, never the page, so
 * changing the page size never changes a total.
 */
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { downloadFile } from '@/lib/utils/download'

export interface ResolvedRange {
  start: string
  end: string
  /** The calendar dates the merchant chose, echoed back so an off-by-one is reproducible rather than arguable. */
  from: string
  to: string
  timeZone: string
}

export interface ReportMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ReportEnvelope<TRow, TSummary> {
  range: ResolvedRange | null
  summary: TSummary
  rows: TRow[]
  meta: ReportMeta
}

export interface DateRangeParams {
  from?: string
  to?: string
}

export interface PagingParams {
  page?: number
  limit?: number
}

// ---------------------------------------------------------------- stock ----

export interface StockReportRow {
  productId: string
  variantId: string | null
  itemName: string
  sku: string | null
  onHand: number
  reserved: number
  available: number
  cachedQuantity: number
  hasQuantityMismatch: boolean
  lowStockThreshold: number
  isLowStock: boolean
  price: number | null
  costPrice: number | null
  /** Null, never 0, when the item has no cost price — it is unvalued, not free. */
  costValue: number | null
  retailValue: number | null
  warehouses: Array<{ warehouseId: string; warehouseName: string; quantity: number; reserved: number }>
}

export interface StockReportSummary {
  itemCount: number
  totalUnits: number
  totalCostValue: number
  totalRetailValue: number
  lowStockCount: number
  unvaluedItemCount: number
  unvaluedUnitCount: number
  mismatchedItemCount: number
}

export interface StockReportParams extends PagingParams {
  warehouseId?: string
  categoryId?: string
  brandId?: string
  searchTerm?: string
  lowStockOnly?: boolean
  mismatchedOnly?: boolean
}

// -------------------------------------------------------- stock history ----

export interface StockHistoryRow {
  id: string
  createdAt: string
  type: string
  quantity: number
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  warehouseId: string | null
  warehouseName: string | null
  note: string | null
  referenceId: string | null
  balance: number
}

export interface StockHistorySummary {
  opening: number
  quantityIn: number
  quantityOut: number
  closing: number
  movementCount: number
  /** When true, opening and closing describe the UNFILTERED position — the page must say so. */
  isTypeFiltered: boolean
}

export interface StockHistoryParams extends DateRangeParams, PagingParams {
  productId?: string
  variantId?: string
  warehouseId?: string
  type?: string
}

// ---------------------------------------------------------------- sales ----

export interface SalesReportSummary {
  orderCount: number
  grossSales: number
  discount: number
  shipping: number
  tax: number
  orderTotal: number
  collected: number
  outstanding: number
  refunded: number
  net: number
}

export interface SalesGroupRow {
  key: string
  label: string
  orderCount: number
  quantity: number | null
  orderTotal: number
  collected: number
}

export interface SalesOrderRow {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string
  isGuestOrder: boolean
  status: string
  grossSales: number
  discount: number
  shipping: number
  tax: number
  orderTotal: number
  collected: number
  outstanding: number
  refunded: number
}

export type SalesGroupBy = 'day' | 'product' | 'category' | 'method'

export interface SalesReportParams extends DateRangeParams, PagingParams {
  groupBy?: SalesGroupBy
  status?: string
  method?: string
  guestOnly?: boolean
}

export interface SalesReportResult extends ReportEnvelope<SalesOrderRow, SalesReportSummary> {
  groups: SalesGroupRow[] | null
  groupBy: SalesGroupBy | null
}

// ------------------------------------------------------------ purchases ----

export interface PurchaseReportRow {
  id: string
  purchaseNumber: string
  createdAt: string
  supplierId: string
  supplierName: string
  supplierIsActive: boolean
  status: string
  quantityOrdered: number
  quantityReceived: number
  quantityOutstanding: number
  subtotal: number
  shippingCost: number
  taxAmount: number
  purchaseValue: number
  amountPaid: number
  balanceOwed: number
  settlementState: 'UNPAID' | 'PARTIALLY_PAID' | 'SETTLED'
  receiptState: 'AWAITING' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED'
}

export interface PurchaseReportSummary {
  purchaseOrderCount: number
  quantityOrdered: number
  quantityReceived: number
  purchaseValue: number
  amountPaid: number
  balanceOwed: number
  excludedDraftCount: number
  cancelledCount: number
}

export interface PurchaseGroupRow {
  key: string
  label: string
  purchaseOrderCount: number
  purchaseValue: number
  amountPaid: number
  balanceOwed: number
}

export type PurchaseGroupBy = 'supplier' | 'status' | 'day'

export interface PurchaseReportParams extends DateRangeParams, PagingParams {
  groupBy?: PurchaseGroupBy
  supplierId?: string
  status?: string
  includeDrafts?: boolean
  owingOnly?: boolean
}

export interface PurchaseReportResult
  extends ReportEnvelope<PurchaseReportRow, PurchaseReportSummary> {
  groups: PurchaseGroupRow[] | null
  groupBy: PurchaseGroupBy | null
}

// ------------------------------------------------------------- payments ----

export interface PaymentReportRow {
  id: string
  direction: 'IN' | 'OUT'
  effectiveDate: string
  /** False when the date fell back to the record date because the payment has not settled. */
  isSettled: boolean
  amount: number
  method: string
  status: string
  counterpartyId: string | null
  counterpartyName: string
  isGuest: boolean
  documentId: string | null
  documentNumber: string | null
  reference: string | null
}

export interface PaymentReportSummary {
  moneyIn: number
  moneyOut: number
  net: number
  /** Recorded but not settled. Held OUT of moneyIn on purpose. */
  pending: number
  refunded: number
  inCount: number
  outCount: number
}

export interface PaymentReportParams extends DateRangeParams, PagingParams {
  direction?: 'IN' | 'OUT'
  method?: string
  status?: string
  customerId?: string
  supplierId?: string
  sortOrder?: 'asc' | 'desc'
}

// ---------------------------------------------------------------- shared ---

/**
 * Only defined, non-empty values are sent. A blank `supplierId=` is a filter
 * matching nothing, not the absence of a filter — the same trap `list-query.ts`
 * documents for `searchTerm`. Booleans go as "true"/"false" because the backend
 * parses them from strings.
 */
function buildReportQuery(params: Record<string, unknown>): URLSearchParams {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, typeof value === 'boolean' ? String(value) : String(value))
  }

  return query
}

async function fetchReport<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const res = await request<T>(`${path}?${buildReportQuery(params)}`)
  return res.data
}

/** Same path, same filters, `format=csv` — so an export answers exactly the question the screen does. */
function exportReport(path: string, params: Record<string, unknown>, fallbackFilename: string) {
  const query = buildReportQuery({ ...params, format: 'csv' })
  // Paging is meaningless for an export: the server streams every matching row.
  query.delete('page')
  query.delete('limit')
  return downloadFile(`${path}?${query}`, fallbackFilename)
}

// ----------------------------------------------------------------- hooks ---

export function useStockReport(params: StockReportParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.stock(params),
    queryFn: () =>
      fetchReport<ReportEnvelope<StockReportRow, StockReportSummary>>(
        '/reports/stock',
        params as Record<string, unknown>,
      ),
  })
}

export function useStockHistoryReport(params: StockHistoryParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.stockHistory(params),
    queryFn: () =>
      fetchReport<ReportEnvelope<StockHistoryRow, StockHistorySummary>>(
        '/reports/stock-history',
        params as Record<string, unknown>,
      ),
  })
}

export function useSalesReport(params: SalesReportParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.sales(params),
    queryFn: () => fetchReport<SalesReportResult>('/reports/sales', params as Record<string, unknown>),
  })
}

export function usePurchaseReport(params: PurchaseReportParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.purchases(params),
    queryFn: () =>
      fetchReport<PurchaseReportResult>('/reports/purchases', params as Record<string, unknown>),
  })
}

export function usePaymentReport(params: PaymentReportParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.payments(params),
    queryFn: () =>
      fetchReport<ReportEnvelope<PaymentReportRow, PaymentReportSummary>>(
        '/reports/payments',
        params as Record<string, unknown>,
      ),
  })
}

export const reportExports = {
  stock: (params: StockReportParams) =>
    exportReport('/reports/stock', params as Record<string, unknown>, 'stock-report.csv'),
  stockHistory: (params: StockHistoryParams) =>
    exportReport('/reports/stock-history', params as Record<string, unknown>, 'stock-history.csv'),
  sales: (params: SalesReportParams) =>
    exportReport('/reports/sales', params as Record<string, unknown>, 'sales-report.csv'),
  purchases: (params: PurchaseReportParams) =>
    exportReport('/reports/purchases', params as Record<string, unknown>, 'purchases-report.csv'),
  payments: (params: PaymentReportParams) =>
    exportReport('/reports/payments', params as Record<string, unknown>, 'payment-history.csv'),
}
