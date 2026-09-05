/**
 * Real backend supplier-payment calls — money paid OUT to a supplier against a
 * purchase order. Mirrors `payments.ts`, which does the same for money coming
 * in from a customer against an order.
 *
 * Unlike `payments.ts` this one has update and delete: a supplier payment is a
 * record of something that happened outside the system, so a merchant who
 * typed the wrong amount must be able to fix it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * Deliberately not `PaymentMethod` from `payments.ts`: COD/STRIPE/PAYPAL
 * cannot describe money leaving the store, and CASH/CHEQUE — how most supplier
 * payments here happen — are missing from it. The backend enum enforces the
 * same split.
 */
export type SupplierPaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'CARD'
  | 'OTHER'

export const SUPPLIER_PAYMENT_METHODS: Array<{ value: SupplierPaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

export type SettlementState = 'UNPAID' | 'PARTIALLY_PAID' | 'SETTLED'

export interface SupplierPayment {
  id: string
  purchaseOrderId: string
  supplierId: string
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  amount: string
  method: SupplierPaymentMethod
  reference: string | null
  paidAt: string
  note: string | null
  createdAt: string
  updatedAt: string
  supplier?: { id: string; name: string; companyName: string | null }
}

/** The list endpoint returns the payments AND the settlement position, so the page never adds the amounts itself. */
export interface SupplierPaymentList {
  payments: SupplierPayment[]
  totalAmount: number
  amountPaid: number
  balanceDue: number
  settlementState: SettlementState
}

export interface RecordSupplierPaymentInput {
  amount: number
  method: SupplierPaymentMethod
  paidAt?: string
  reference?: string
  note?: string
}

export interface UpdateSupplierPaymentInput {
  amount?: number
  method?: SupplierPaymentMethod
  paidAt?: string
  reference?: string | null
  note?: string | null
}

async function listSupplierPayments(purchaseOrderId: string): Promise<SupplierPaymentList> {
  const res = await request<SupplierPaymentList>(`/purchase-orders/${purchaseOrderId}/payments`)
  return res.data
}

async function recordSupplierPayment(
  purchaseOrderId: string,
  input: RecordSupplierPaymentInput,
): Promise<SupplierPayment> {
  const res = await request<SupplierPayment>(`/purchase-orders/${purchaseOrderId}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateSupplierPayment(
  purchaseOrderId: string,
  paymentId: string,
  input: UpdateSupplierPaymentInput,
): Promise<SupplierPayment> {
  const res = await request<SupplierPayment>(
    `/purchase-orders/${purchaseOrderId}/payments/${paymentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return res.data
}

async function deleteSupplierPayment(purchaseOrderId: string, paymentId: string): Promise<void> {
  await request<SupplierPayment>(`/purchase-orders/${purchaseOrderId}/payments/${paymentId}`, {
    method: 'DELETE',
  })
}

export function useSupplierPayments(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.supplierPayments.byPurchaseOrder(purchaseOrderId ?? ''),
    queryFn: () => listSupplierPayments(purchaseOrderId!),
    enabled: !!purchaseOrderId,
  })
}

/**
 * Every mutation invalidates the purchase order too: `amountPaid`,
 * `balanceDue` and `settlementState` are computed server-side from these rows,
 * so a payment change makes the cached purchase order stale.
 */
function invalidateAfterPaymentChange(
  client: ReturnType<typeof useQueryClient>,
  purchaseOrderId: string,
) {
  client.invalidateQueries({ queryKey: queryKeys.supplierPayments.byPurchaseOrder(purchaseOrderId) })
  client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(purchaseOrderId) })
  client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
  client.invalidateQueries({ queryKey: queryKeys.reports.all })
}

export function useRecordSupplierPayment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      purchaseOrderId,
      input,
    }: {
      purchaseOrderId: string
      input: RecordSupplierPaymentInput
    }) => recordSupplierPayment(purchaseOrderId, input),
    onSuccess: (_d, variables) => invalidateAfterPaymentChange(client, variables.purchaseOrderId),
  })
}

export function useUpdateSupplierPayment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      purchaseOrderId,
      paymentId,
      input,
    }: {
      purchaseOrderId: string
      paymentId: string
      input: UpdateSupplierPaymentInput
    }) => updateSupplierPayment(purchaseOrderId, paymentId, input),
    onSuccess: (_d, variables) => invalidateAfterPaymentChange(client, variables.purchaseOrderId),
  })
}

export function useDeleteSupplierPayment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ purchaseOrderId, paymentId }: { purchaseOrderId: string; paymentId: string }) =>
      deleteSupplierPayment(purchaseOrderId, paymentId),
    onSuccess: (_d, variables) => invalidateAfterPaymentChange(client, variables.purchaseOrderId),
  })
}
