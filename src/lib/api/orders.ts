/**
 * Real backend order calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`.
 *
 * `_getAllOrders()` at the bottom is a compatibility shim: `customers.ts` still reads it
 * synchronously (its own mock-to-real migration is a later change — see design.md Decision 4 in
 * openspec/changes/integrate-orders-api). Don't add new callers of it.
 *
 * Orders CAN now be created from here, through `POST /orders/manual` — the seller's side of a
 * WhatsApp or Messenger conversation. That endpoint is not `POST /orders`: the latter is the
 * shopper's checkout, runs under `optionalAuth` so guests can reach it, and must never grow a
 * field like `discountAmount`. Pricing goes through `POST /orders/quote/manual` for the same
 * reason — the shopper's `/orders/quote` would price an admin's OWN cart, which is correct there
 * and wrong here.
 *
 * Cancellation still isn't a separate call: the dedicated cancel endpoint is customer-self-service
 * only, so admin cancellation goes through `updateOrderStatus` with `status: 'CANCELLED'` like any
 * other status change.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Payment } from '@/lib/api/payments'
import type { Shipment } from '@/lib/api/shipments'

/**
 * Mirrors the backend `OrderStatus` enum. `PACKED` means picked and boxed but
 * not yet handed to a carrier — see openspec/changes/add-order-fulfillment-documents.
 *
 * Which transitions are legal is NOT encoded here: the server sends
 * `allowedTransitions` on every detail read, and the UI offers exactly those.
 */
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED'

export const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'COMPLETED']

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
  /**
   * The line's current picture: the variant's own image when the line names a
   * variant that has one, else the product's primary image, else null.
   *
   * Present on BOTH list and detail reads, and in the same shape for staff and
   * for the customer — the server flattens the nested relations at every
   * boundary. A product with no photography legitimately has none, so null is a
   * normal value here rather than a failure; `Thumbnail` renders it.
   *
   * Deliberately NOT a snapshot taken at placement, unlike `productName`, `sku`
   * and `unitPrice` beside it. Those are what the customer was sold and are
   * accountable facts of the transaction; a photograph is not, so replacing a
   * product's image shows through to past orders and does not make their record
   * untrue. An operator matching a parcel against a shelf wants the picture of
   * what is on the shelf now.
   */
  image: string | null
}

/**
 * Where the CUSTOMER reached the shop — not how the order was entered.
 *
 * `WEBSITE` means the shopper placed it themselves and is the server's column
 * default, so it is what every order placed before manual entry existed reads
 * as. The rest are conversations a seller turned into an order by hand.
 *
 * There is no `LANDING_PAGE`: campaign attribution is `landingPageId`, and two
 * fields answering one question is how the two come to disagree.
 */
export type OrderChannel = 'WEBSITE' | 'WHATSAPP' | 'MESSENGER' | 'PHONE' | 'IN_STORE' | 'OTHER'

/** What staff may select when recording an order — `WEBSITE` is not offered, and the API rejects it. */
export const MANUAL_ORDER_CHANNELS = [
  'WHATSAPP',
  'MESSENGER',
  'PHONE',
  'IN_STORE',
  'OTHER',
] as const satisfies readonly OrderChannel[]

export type ManualOrderChannel = (typeof MANUAL_ORDER_CHANNELS)[number]

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp',
  MESSENGER: 'Messenger',
  PHONE: 'Phone',
  IN_STORE: 'In person',
  OTHER: 'Other',
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
  /**
   * Present on BOTH list and detail responses. The list once omitted items
   * (keeping the paginated payload light), but the orders table now names what
   * each order bought, so they ride along from the same `ORDER_LIST_INCLUDE`.
   * Still treated as optional here because the `_getAllOrders()` shim catches a
   * fetch failure into an empty cache, and empty is representable while a bare
   * `undefined` needs the callers' `?? []` fallbacks to survive.
   */
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
  /**
   * Why a discount was given, when a person decided to give one.
   *
   * Set only on a staff-placed order — a price negotiated in a WhatsApp
   * conversation has no code to point at. Null for a coupon discount, which
   * `couponCode` already explains, and null for no discount at all.
   */
  discountReason: string | null
  /**
   * Where the customer came from. Defaults to `WEBSITE` server-side, so every
   * order has one.
   */
  channel: OrderChannel
  /**
   * Which staff member recorded this order, when one did.
   *
   * Null means nobody placed it on the customer's behalf — i.e. the customer
   * placed it themselves. The absence is the signal, so render nothing rather
   * than a dash or "unknown", which would read as missing data.
   */
  createdByUserId: string | null
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
  /**
   * Present on BOTH list and detail responses — the list's Customer column
   * shows where each parcel goes. Null (not "—") for collection orders, which
   * have no delivery address at all.
   */
  shippingAddress: OrderShippingAddress | null
  /** Only present on detail responses (`GET /orders/:id`) — list rows omit these. */
  payments?: Payment[]
  /**
   * Present on BOTH list and detail responses, but with different shapes.
   *
   * A detail read returns whole shipment rows. A list read returns at most one,
   * narrowed to the three courier fields the orders table shows at a glance —
   * deliberately, so the list needs no per-row shipment request (the N+1 the
   * integrate-orders-api change removed).
   *
   * So treat every field beyond those three as detail-only when reading a list
   * row. See the server's ORDER_LIST_INCLUDE.
   */
  shipments?: (Partial<Shipment> &
    Pick<Shipment, 'consignmentId' | 'courierStatus' | 'trackingNumber'>)[]
  /** Only present on detail responses. */
  statusHistory?: OrderStatusEvent[]
  /**
   * The statuses this order may still move to, computed server-side from the
   * same transition map the API enforces. Staff detail reads only.
   *
   * Read rather than restated here: cancelling before fulfilment returns stock
   * to the shelf, so a transition that could not happen physically produces
   * side effects nothing can reconcile. Absent (older backend) means the page
   * falls back to offering nothing rather than guessing.
   */
  allowedTransitions?: OrderStatus[]
  createdAt: string
  updatedAt: string
}

export interface OrderListParams extends ListParams {
  status?: OrderStatus
  /**
   * Narrows to one channel. Sent to the backend, which filters through its
   * QueryBuilder — never applied to the fetched page, which would answer
   * "WhatsApp orders among these ten" while reading as "WhatsApp orders".
   */
  channel?: OrderChannel
}

export interface UpdateOrderStatusInput {
  status: OrderStatus
  note?: string
}

/** One line of a manual order. No price field: the server prices from the catalog. */
export interface ManualOrderLineInput {
  productId: string
  variantId?: string
  quantity: number
}

export interface ManualOrderAddressInput {
  addressLine1: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface CreateManualOrderInput {
  /** The customer's identity. Normalized server-side, so the stored value may differ. */
  phone: string
  fullName?: string
  shippingAddress: ManualOrderAddressInput
  items: ManualOrderLineInput[]
  deliveryOptionKey: string
  channel: ManualOrderChannel
  /** Required by the API whenever `discountAmount` is above zero. */
  discountAmount?: number
  discountReason?: string
  notes?: string
}

/** What the form needs priced. Mirrors the placement payload minus the customer. */
export interface ManualOrderQuoteInput {
  items: ManualOrderLineInput[]
  deliveryOptionKey: string
  discountAmount?: number
}

export interface ManualOrderQuote {
  subtotal: number
  discountAmount: number
  taxAmount: number
  shippingAmount: number
  /** Delivery before any waiver, so "Free" can be shown as a saving. */
  shippingBeforeWaiver: number
  deliveryDays: number | null
  totalAmount: number
  delivery: {
    optionKey: string
    optionLabel: string
    method: 'DELIVERY' | 'PICKUP'
    price: number
    days: number
  } | null
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
  if (params.channel) query.set('channel', params.channel)

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

/**
 * Records an order taken off-site.
 *
 * `idempotencyKey` is a header rather than a body field, mirroring the server,
 * and the CALLER owns it: it must survive a retry of the same order so a second
 * attempt replays instead of sending the customer a second parcel. Minting one
 * here would defeat the purpose, because every retry would mint a fresh one.
 */
async function createManualOrder(
  input: CreateManualOrderInput,
  idempotencyKey: string,
): Promise<Order> {
  const res = await request<Order>('/orders/manual', {
    method: 'POST',
    /*
     * Content-Type is restated here and must be. `request()` spreads `init`
     * LAST, so a `headers` object passed in replaces its default outright
     * rather than merging — dropping the JSON content type, which makes the
     * backend fail to parse the body. The one other caller that sets headers
     * (uploads) sends FormData and wants exactly that behaviour.
     */
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
  return res.data
}

/**
 * Prices an order still being typed.
 *
 * The panel never works a total out for itself. Tax comes from each product's
 * own rule, the discount is allocated across lines BEFORE tax, and delivery can
 * be waived by a free-shipping threshold — so a figure computed here would be
 * right until the first rule changed, and the operator would already have read
 * it to the customer. See design.md, Decision 1.
 */
async function quoteManualOrder(input: ManualOrderQuoteInput): Promise<ManualOrderQuote> {
  const res = await request<ManualOrderQuote>('/orders/quote/manual', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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

export function useCreateManualOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateManualOrderInput; idempotencyKey: string }) =>
      createManualOrder(input, idempotencyKey),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

/**
 * The running total for an order being typed.
 *
 * A mutation rather than a query, deliberately. The form owns when to price —
 * it debounces the operator's typing and disables submit until a fresh figure
 * has landed — and a query keyed on the whole draft would cache a total per
 * keystroke, each entry stale the moment the catalog moves. Nothing here is
 * worth re-reading later; only the newest answer matters.
 */
export function useManualOrderQuote() {
  return useMutation({ mutationFn: quoteManualOrder })
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
