/** Real backend payment calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. No update/void endpoint exists: payments are create-and-list only. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export type PaymentMethod = 'COD' | 'CARD' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'

export interface Payment {
  id: string
  orderId: string
  transactionId: string | null
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  gateway: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RecordPaymentInput {
  amount: number
  method: PaymentMethod
  status?: PaymentStatus
  transactionId?: string
}

async function listPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const res = await request<Payment[]>(`/orders/${orderId}/payments`)
  return res.data
}

async function recordPayment(orderId: string, input: RecordPaymentInput): Promise<Payment> {
  const res = await request<Payment>(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(input) })
  return res.data
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
    mutationFn: ({ orderId, input }: { orderId: string; input: RecordPaymentInput }) => recordPayment(orderId, input),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.payments.byOrder(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
