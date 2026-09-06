/**
 * Real backend order calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 *
 * `_getAllOrders()` at the bottom is a compatibility shim: `customers.ts` still reads it
 * synchronously (its own mock-to-real migration is a later change — see design.md Decision 4 in
 * openspec/changes/integrate-orders-api). Don't add new callers of it.
 *
 * There is no order-create function here: the real backend only creates orders through customer
 * checkout (`POST /orders` against the caller's own cart) — there's no admin "create order on a
 * customer's behalf" capability to wrap. Cancellation similarly isn't a separate call: the
 * dedicated cancel endpoint is customer-self-service only, so admin cancellation goes through
 * `updateOrderStatus` with `status: 'CANCELLED'` like any other status change.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Payment } from '@/lib/api/payments'
import type { Shipment } from '@/lib/api/shipments'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED'

export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'COMPLETED']

export interface OrderLineItem {
  productId: string
  variantId: string | null
  productName: string
  sku: string | null
  quantity: number
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  unitPrice: string
  /** Decimal column — arrives as a string from the API. */
  totalPrice: string
}

export interface OrderStatusEvent {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  note: string | null
  changedById: string | null
  createdAt: string
}

export interface OrderCustomerRef {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
}

export interface OrderShippingAddress {
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  postalCode: string | null
  country: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customer: OrderCustomerRef
  status: OrderStatus
  /** Only present on detail responses (`GET /orders/:id`) — list rows omit it. */
  items?: OrderLineItem[]
  /** Decimal column — arrives as a string from the API. */
  subtotal: string
  /** Decimal column — arrives as a string from the API. */
  discountAmount: string
  /** Decimal column — arrives as a string from the API. */
  shippingAmount: string
  /** Decimal column — arrives as a string from the API. */
  taxAmount: string
  /** Decimal column — arrives as a string from the API. */
  totalAmount: string
  couponCode: string | null
  notes: string | null
  /**
   * The campaign that produced this order, when it came from a landing page.
   * Null for every order placed through the normal checkout.
   *
   * Two fields because they answer different questions and fail differently.
   * `landingPage` is the still-existing page, present only on detail responses,
   * and is what makes the order linkable back to its campaign.
   * `landingPageTitle` was captured AT PLACEMENT and survives the page being
   * deleted or renamed — which is what keeps a finished campaign's orders
   * readable.
   *
   * Which delivery zone a LANDING-PAGE shopper chose is not here: it is on
   * `shippingAddress.state`, because those zones belong to the page rather than
   * to the store. A shop order carries its choice in the delivery fields below.
   */
  landingPageId: string | null
  landingPageTitle: string | null
  /**
   * What the shopper chose at checkout, captured when the order was placed.
   *
   * `deliveryOptionLabel` does NOT change when the merchant later renames,
   * reprices or deletes that option — it is what this shopper agreed to, and it
   * is what keeps the order readable once the option is gone.
   * `deliveryOptionKey` is the stable handle that survives a rename, so counting
   * orders by option still works after the list is edited.
   *
   * All three null for two populations that legitimately have no choice
   * recorded: orders placed before delivery options existed, and landing-page
   * orders, which are priced by the page's own zones.
   */
  deliveryMethod: 'DELIVERY' | 'PICKUP' | null
  deliveryOptionKey: string | null
  deliveryOptionLabel: string | null
  /** Only present on detail responses (`GET /orders/:id`). */
  landingPage?: { id: string; title: string; slug: string } | null
  shippingAddress: OrderShippingAddress | null
  /** Only present on detail responses (`GET /orders/:id`) — list rows omit these. */
  payments?: Payment[]
  /** Only present on detail responses. */
  shipments?: Shipment[]
  /** Only present on detail responses. */
  statusHistory?: OrderStatusEvent[]
  createdAt: string
  updatedAt: string
}

export interface OrderListParams extends ListParams {
  status?: OrderStatus
}

export interface UpdateOrderStatusInput {
  status: OrderStatus
  note?: string
}

async function listOrders(params: OrderListParams = {}): Promise<PaginatedResponse<Order>> {
  const limit = params.limit ?? 100

  // No customer-name search, no date range, no customerId filter — GET /orders only supports
  // these (see design.md).
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<Order[]>(`/orders?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getOrder(id: string): Promise<Order> {
  const res = await request<Order>(`/orders/${id}`)
  return res.data
}

async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  const res = await request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

export function useOrders(params: OrderListParams = {}) {
  return useQuery({ queryKey: queryKeys.orders.list(params), queryFn: () => listOrders(params) })
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.orders.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id })
}

export function useUpdateOrderStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrderStatusInput }) => updateOrderStatus(id, input),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(v.id) })
    },
  })
}

// --- Compatibility shim for still-mock modules (see file header) ---

let ordersCache: Order[] = []
let ordersCachePromise: Promise<Order[]> | null = null

function loadOrdersCache(): Promise<Order[]> {
  if (!ordersCachePromise) {
    ordersCachePromise = listOrders({ limit: 500 })
      .then((res) => {
        ordersCache = res.data
        return ordersCache
      })
      .catch(() => ordersCache)
  }
  return ordersCachePromise
}
void loadOrdersCache()

/**
 * @deprecated Synchronous order snapshot for modules not yet migrated to the real API (see file
 * header). Returns whatever's cached — `[]` until the first background fetch resolves.
 */
export function _getAllOrders(): Order[] {
  return ordersCache
}
