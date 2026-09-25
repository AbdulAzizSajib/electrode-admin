/**
 * Real backend payment calls — follows the same envelope/error pattern as
 * `categories.ts`/`products.ts`.
 *
 * Four operations, not two. Beyond create and list there is
 * `PATCH /orders/:id/payments/:paymentId`, which sets a status outright, and the
 * pair of named advance-payment decisions — verify and reject — which are what
 * releases an order held on an unverified claim. This comment used to say "no
 * update/void endpoint exists: payments are create-and-list only"; the PATCH was
 * already there when it said so, and the decisions arrived with
 * `add-advance-payment-checkout`. The PATCH is deliberately still unwrapped
 * here: a claim is decided through verify/reject so the verifier is recorded,
 * and spelling it as a status write would lose that.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export type PaymentMethod = 'COD' | 'CARD' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'

/**
 * The payment methods an advance-payment claim can be made through.
 *
 * Mirrors `ADVANCE_PAYMENT_METHODS` in the backend's `order.service.ts`, which
 * is the list the blocking predicate and the verification queue both read. A row
 * on any other method — a COD row, a card payment — is not a claim and carries
 * none of the fields below.
 */
export const ADVANCE_PAYMENT_METHODS: PaymentMethod[] = ['BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER']

/**
 * The merchant account details as the shopper read them off the checkout page.
 *
 * Snapshotted at placement, so it stays readable after the merchant edits or
 * deletes the account — which is the point of storing it beside the account id
 * rather than instead of it. Loosely typed because the snapshot is whichever
 * shape the account had: a mobile account carries `provider`/`number`, a bank
 * account carries `bankName`/`accountNumber` and friends.
 */
export interface PaidToAccountSnapshot {
  provider?: string
  number?: string
  accountType?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  branch?: string
  routingNumber?: string
}

/** The staff member who decided a claim. Joined for staff callers only. */
export interface PaymentVerifier {
  id: string
  name: string | null
  email: string | null
}

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
  /*
   * The advance-payment claim. All null on every payment that is not one — a COD
   * row records money collected at the door and has nothing to review. See
   * server/openspec/changes/add-advance-payment-checkout.
   */
  /** What the shopper says sent the money: their own number, or a depositor name. */
  senderIdentifier: string | null
  /** Which configured merchant account, by the id it carries in store settings. */
  paidToAccountId: string | null
  paidToAccountSnapshot: PaidToAccountSnapshot | null
  verifiedByUserId: string | null
  verifiedBy: PaymentVerifier | null
  /** When the claim was decided, verified or rejected alike — not when money arrived. */
  verifiedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

/** A pending claim with just enough of its order to be actionable from a queue. */
export interface PendingVerification extends Payment {
  order: {
    id: string
    orderNumber: string
    status: string
    totalAmount: string
    createdAt: string
    customer: {
      id: string
      firstName: string
      lastName: string | null
      phone: string | null
    } | null
  }
}

export interface RecordPaymentInput {
  amount: number
  method: PaymentMethod
  status?: PaymentStatus
  transactionId?: string
}

/**
 * Whether this payment is one a decision is still owed on.
 *
 * EXACTLY the backend's `isAwaitingPaymentVerification` — an advance method in
 * PROCESSING — and it must stay exactly that. The panel offers Verify precisely
 * when the server is refusing to move the order, so a narrower rule here (say,
 * also demanding a sender identifier) would strand a blocked order with no
 * control to release it, and a wider one would offer a decision the server
 * refuses. A verified claim is PAID and a rejected one FAILED, so neither is
 * undecided.
 */
export function isUndecidedClaim(payment: Payment): boolean {
  return ADVANCE_PAYMENT_METHODS.includes(payment.method) && payment.status === 'PROCESSING'
}

/**
 * Whether there is a claim to READ — a separate question from whether one is
 * owed a decision.
 *
 * A decided claim still has all its detail and still has to be shown, so this
 * asks about the captured values rather than the status. Keyed on the sender
 * identifier because that is the field only the checkout claim path writes: a
 * bank transfer recorded by staff through `POST .../payments` after collecting
 * money has a method and a reference but nobody's number, and is money collected
 * rather than a claim anyone made.
 */
export function hasClaimDetails(payment: Payment): boolean {
  return payment.senderIdentifier !== null || payment.paidToAccountId !== null
}

async function listPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const res = await request<Payment[]>(`/orders/${orderId}/payments`)
  return res.data
}

async function recordPayment(orderId: string, input: RecordPaymentInput): Promise<Payment> {
  const res = await request<Payment>(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function verifyPayment(orderId: string, paymentId: string): Promise<Payment> {
  const res = await request<Payment>(`/orders/${orderId}/payments/${paymentId}/verify`, { method: 'POST' })
  return res.data
}

async function rejectPayment(orderId: string, paymentId: string, reason: string): Promise<Payment> {
  const res = await request<Payment>(`/orders/${orderId}/payments/${paymentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return res.data
}

async function listPendingVerifications(): Promise<PendingVerification[]> {
  const res = await request<PendingVerification[]>('/payments/pending-verification')
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

/**
 * The ORDER detail is invalidated alongside the payment list, and that is the
 * load-bearing half.
 *
 * Verifying is what releases an order held on an unverified claim, and the
 * statuses the panel offers come from the order's own server-computed
 * `allowedTransitions`. Without this invalidation the claim would read Verified
 * while the status control still refused to move — the operator's next click
 * would be answered by a 409 about a verification that had already happened.
 */
function useClaimDecision<TArgs extends { orderId: string }>(
  mutationFn: (args: TArgs) => Promise<Payment>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.payments.byOrder(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
      // The queue is a list of undecided claims, and this one just left it.
      client.invalidateQueries({ queryKey: queryKeys.payments.pendingVerification })
    },
  })
}

export function useVerifyPayment() {
  return useClaimDecision(({ orderId, paymentId }: { orderId: string; paymentId: string }) =>
    verifyPayment(orderId, paymentId),
  )
}

export function useRejectPayment() {
  return useClaimDecision(
    ({ orderId, paymentId, reason }: { orderId: string; paymentId: string; reason: string }) =>
      rejectPayment(orderId, paymentId, reason),
  )
}

export function usePendingVerifications() {
  return useQuery({
    queryKey: queryKeys.payments.pendingVerification,
    queryFn: listPendingVerifications,
  })
}
