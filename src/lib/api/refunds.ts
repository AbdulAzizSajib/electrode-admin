import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllOrders, _getOrderById } from '@/lib/api/orders'
import type { PaymentMethod } from '@/lib/api/payments'

export type RefundStatus = 'pending' | 'completed'

export interface Refund {
  id: string
  orderId: string
  amount: number
  method: PaymentMethod
  status: RefundStatus
  createdAt: string
}

let refunds: Refund[] = []

function seed() {
  const cancelled = _getAllOrders().filter((o) => o.paymentStatus === 'refunded')
  cancelled.forEach((order) => {
    refunds.push({ id: generateId('rfd'), orderId: order.id, amount: order.total, method: 'card', status: 'completed', createdAt: order.createdAt })
  })
}
seed()

export interface RefundListParams extends ListParams {
  status?: RefundStatus
}

async function listRefunds(params: RefundListParams = {}) {
  const orders = _getAllOrders()
  let filtered = [...refunds].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (params.status) filtered = filtered.filter((r) => r.status === params.status)
  const rows = filtered.map((r) => ({ ...r, orderNumber: orders.find((o) => o.id === r.orderId)?.orderNumber ?? '—' }))
  return delay(paginate(rows, params) as PaginatedResponse<(typeof rows)[number]>)
}

async function createRefund(orderId: string, amount: number, method: PaymentMethod): Promise<Refund> {
  const order = _getOrderById(orderId)
  if (!order) throw new ApiError('Order not found', 404)
  if (amount <= 0) throw new ApiError('Amount must be greater than zero.', 422)

  const refund: Refund = { id: generateId('rfd'), orderId, amount, method, status: 'completed', createdAt: new Date().toISOString() }
  refunds = [refund, ...refunds]
  recordAuditEntry({ action: 'refund.created', resourceType: 'refund', resourceId: refund.id, resourceLabel: `${order.orderNumber} — $${amount.toFixed(2)}` })
  return delay(refund)
}

export function useRefunds(params: RefundListParams = {}) {
  return useQuery({ queryKey: queryKeys.refunds.list(params), queryFn: () => listRefunds(params) })
}

export function useCreateRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, amount, method }: { orderId: string; amount: number; method: PaymentMethod }) =>
      createRefund(orderId, amount, method),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.refunds.all }),
  })
}
