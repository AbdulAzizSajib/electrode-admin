import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllUsers } from '@/lib/api/users'
import { _getAllProducts } from '@/lib/api/products'
import { _getAllShippingMethods } from '@/lib/api/shipping-methods'
import type { Address } from '@/lib/api/shared-types'

export type FulfillmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded'

export const FULFILLMENT_SEQUENCE: FulfillmentStatus[] = ['pending', 'processing', 'shipped', 'delivered']

export interface OrderLineItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
}

export interface OrderStatusEvent {
  status: FulfillmentStatus
  at: string
  note?: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  items: OrderLineItem[]
  subtotal: number
  discount: number
  shippingCost: number
  tax: number
  total: number
  shippingAddress: Address
  shippingMethodId: string
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  statusHistory: OrderStatusEvent[]
  couponCode?: string
  createdAt: string
}

let orderSequence = 58210
let orders: Order[] = []

function buildOrder(
  customerIndex: number,
  productIndexes: number[],
  fulfillmentStatus: FulfillmentStatus,
  paymentStatus: PaymentStatus,
  daysAgo: number,
): Order {
  const customers = _getAllUsers().filter((u) => u.role === 'CUSTOMER')
  const products = _getAllProducts()
  const shippingMethods = _getAllShippingMethods()
  const customer = customers[customerIndex % customers.length]
  const items: OrderLineItem[] = productIndexes.map((pi) => {
    const p = products[pi % products.length]
    return { productId: p.id, productName: p.name, sku: p.sku, quantity: 1 + (pi % 3), unitPrice: p.price }
  })
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const discount = paymentStatus === 'refunded' ? subtotal * 0.1 : 0
  const shippingCost = shippingMethods[customerIndex % shippingMethods.length]?.price ?? 5.99
  const tax = Math.round(subtotal * 0.08 * 100) / 100
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  const history: OrderStatusEvent[] = [{ status: 'pending', at: createdAt }]
  FULFILLMENT_SEQUENCE.slice(1, FULFILLMENT_SEQUENCE.indexOf(fulfillmentStatus) + 1).forEach((status, i) => {
    history.push({ status, at: new Date(new Date(createdAt).getTime() + (i + 1) * 3_600_000).toISOString() })
  })

  return {
    id: generateId('ord'),
    orderNumber: `ORD-${orderSequence++}`,
    customerId: customer.id,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    shippingCost,
    tax,
    total: Math.round((subtotal - discount + shippingCost + tax) * 100) / 100,
    shippingAddress: customer.addresses[0] ?? { fullName: customer.name, line1: '123 Main St', city: 'Austin', state: 'TX', postalCode: '73301', country: 'USA' },
    shippingMethodId: shippingMethods[customerIndex % shippingMethods.length]?.id ?? '',
    paymentStatus,
    fulfillmentStatus,
    statusHistory: history,
    createdAt,
  }
}

function seed() {
  orders = [
    buildOrder(0, [0, 3], 'delivered', 'paid', 21),
    buildOrder(1, [1], 'shipped', 'paid', 6),
    buildOrder(2, [4, 5], 'processing', 'paid', 3),
    buildOrder(3, [6], 'pending', 'unpaid', 1),
    buildOrder(4, [7, 8], 'delivered', 'paid', 14),
    buildOrder(5, [9], 'cancelled', 'refunded', 10),
    buildOrder(6, [10, 2], 'processing', 'partially_paid', 2),
    buildOrder(7, [11], 'pending', 'unpaid', 0),
    buildOrder(0, [2, 4], 'delivered', 'paid', 30),
    buildOrder(2, [1, 9], 'shipped', 'paid', 5),
  ]
}
seed()

export function _getAllOrders() {
  return orders
}

export function _getOrderById(id: string) {
  return orders.find((o) => o.id === id)
}

export function _isShippingMethodReferenced(shippingMethodId: string) {
  return orders.some((o) => o.shippingMethodId === shippingMethodId)
}

export function _setOrderPaymentStatus(orderId: string, status: PaymentStatus) {
  orders = orders.map((o) => (o.id === orderId ? { ...o, paymentStatus: status } : o))
}

export function _advanceOrderToShipped(orderId: string) {
  const order = orders.find((o) => o.id === orderId)
  if (!order || order.fulfillmentStatus !== 'processing') return
  orders = orders.map((o) =>
    o.id === orderId
      ? { ...o, fulfillmentStatus: 'shipped', statusHistory: [...o.statusHistory, { status: 'shipped', at: new Date().toISOString() }] }
      : o,
  )
}

export interface OrderListParams extends ListParams {
  status?: FulfillmentStatus
  customerId?: string
  from?: string
  to?: string
}

async function listOrders(params: OrderListParams = {}): Promise<PaginatedResponse<Order & { customerName: string; customerEmail: string }>> {
  const users = _getAllUsers()
  let filtered = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (params.status) filtered = filtered.filter((o) => o.fulfillmentStatus === params.status)
  if (params.customerId) filtered = filtered.filter((o) => o.customerId === params.customerId)
  if (params.from) filtered = filtered.filter((o) => o.createdAt >= params.from!)
  if (params.to) filtered = filtered.filter((o) => o.createdAt <= params.to!)
  if (params.search) {
    const needle = params.search.toLowerCase()
    filtered = filtered.filter((o) => {
      const customer = users.find((u) => u.id === o.customerId)
      return o.orderNumber.toLowerCase().includes(needle) || customer?.name.toLowerCase().includes(needle) || customer?.email.toLowerCase().includes(needle)
    })
  }
  const rows = filtered.map((o) => {
    const customer = users.find((u) => u.id === o.customerId)
    return { ...o, customerName: customer?.name ?? 'Unknown', customerEmail: customer?.email ?? '' }
  })
  return delay(paginate(rows, params))
}

async function getOrder(id: string) {
  const order = orders.find((o) => o.id === id)
  if (!order) throw new ApiError('Order not found', 404)
  const customer = _getAllUsers().find((u) => u.id === order.customerId)
  return delay({ ...order, customerName: customer?.name ?? 'Unknown', customerEmail: customer?.email ?? '' })
}

async function updateOrderStatus(id: string, status: FulfillmentStatus): Promise<Order> {
  const index = orders.findIndex((o) => o.id === id)
  if (index === -1) throw new ApiError('Order not found', 404)
  const current = orders[index]
  const currentIdx = FULFILLMENT_SEQUENCE.indexOf(current.fulfillmentStatus)
  const nextIdx = FULFILLMENT_SEQUENCE.indexOf(status)
  if (nextIdx !== currentIdx + 1) {
    throw new ApiError('Orders can only advance to the next status in sequence.', 422)
  }
  const updated: Order = {
    ...current,
    fulfillmentStatus: status,
    statusHistory: [...current.statusHistory, { status, at: new Date().toISOString() }],
  }
  orders = orders.map((o) => (o.id === id ? updated : o))
  recordAuditEntry({ action: 'order.status_updated', resourceType: 'order', resourceId: id, resourceLabel: `${updated.orderNumber} → ${status}` })
  return delay(updated)
}

async function cancelOrder(id: string): Promise<Order> {
  const index = orders.findIndex((o) => o.id === id)
  if (index === -1) throw new ApiError('Order not found', 404)
  const current = orders[index]
  if (current.fulfillmentStatus === 'shipped' || current.fulfillmentStatus === 'delivered') {
    throw new ApiError('This order has already shipped and cannot be cancelled.', 409)
  }
  const updated: Order = {
    ...current,
    fulfillmentStatus: 'cancelled',
    statusHistory: [...current.statusHistory, { status: 'cancelled', at: new Date().toISOString() }],
  }
  orders = orders.map((o) => (o.id === id ? updated : o))
  recordAuditEntry({ action: 'order.cancelled', resourceType: 'order', resourceId: id, resourceLabel: updated.orderNumber })
  return delay(updated)
}

export function useOrders(params: OrderListParams = {}) {
  return useQuery({ queryKey: queryKeys.orders.list(params), queryFn: () => listOrders(params) })
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.orders.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id })
}

function invalidateOrder(client: ReturnType<typeof useQueryClient>, id: string) {
  client.invalidateQueries({ queryKey: queryKeys.orders.all })
  client.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
}

export function useUpdateOrderStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FulfillmentStatus }) => updateOrderStatus(id, status),
    onSuccess: (_d, v) => invalidateOrder(client, v.id),
  })
}

export function useCancelOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: (_d, id) => invalidateOrder(client, id),
  })
}
