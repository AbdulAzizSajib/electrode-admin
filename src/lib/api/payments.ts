import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllOrders, _getOrderById, _setOrderPaymentStatus, type PaymentStatus } from '@/lib/api/orders'

export type PaymentMethod = 'card' | 'paypal' | 'bank_transfer' | 'cash_on_delivery'
export type PaymentRecordStatus = 'succeeded' | 'pending' | 'failed'

export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  amount: number
  status: PaymentRecordStatus
  transactionRef: string
  createdAt: string
}

let payments: Payment[] = []

function seedFor(orderId: string, amount: number, method: PaymentMethod, createdAt: string) {
  payments.push({ id: generateId('pay'), orderId, method, amount, status: 'succeeded', transactionRef: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, createdAt })
}

function seed() {
  for (const order of _getAllOrders()) {
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      seedFor(order.id, order.total, 'card', order.createdAt)
    } else if (order.paymentStatus === 'partially_paid') {
      seedFor(order.id, Math.round(order.total * 0.5 * 100) / 100, 'card', order.createdAt)
    }
  }
}
seed()

function totalPaid(orderId: string) {
  return payments.filter((p) => p.orderId === orderId && p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0)
}

async function listPaymentsByOrder(orderId: string): Promise<Payment[]> {
  return delay(payments.filter((p) => p.orderId === orderId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

async function recordPayment(orderId: string, amount: number, method: PaymentMethod): Promise<Payment> {
  const order = _getOrderById(orderId)
  if (!order) throw new ApiError('Order not found', 404)
  if (amount <= 0) throw new ApiError('Amount must be greater than zero.', 422)

  const payment: Payment = { id: generateId('pay'), orderId, method, amount, status: 'succeeded', transactionRef: `TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, createdAt: new Date().toISOString() }
  payments = [payment, ...payments]

  const paid = totalPaid(orderId)
  const status: PaymentStatus = paid >= order.total ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid'
  _setOrderPaymentStatus(orderId, status)

  recordAuditEntry({ action: 'payment.recorded', resourceType: 'payment', resourceId: payment.id, resourceLabel: `${order.orderNumber} — $${amount.toFixed(2)}` })
  return delay(payment)
}

export function usePaymentsByOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.byOrder(orderId ?? ''),
    queryFn: () => listPaymentsByOrder(orderId!),
    enabled: !!orderId,
  })
}

export function useRecordPayment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, amount, method }: { orderId: string; amount: number; method: PaymentMethod }) =>
      recordPayment(orderId, amount, method),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.payments.byOrder(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
