/**
 * Steadfast courier dispatch — the admin side of `add-steadfast-courier-integration`.
 *
 * Eligibility rules live entirely on the server. This module deliberately holds
 * none: whether an order can be dispatched depends on things the panel does not
 * carry — whether a composed address exceeds 250 characters, whether a stored
 * phone converts to the courier's format, whether a consignment already exists —
 * and guessing at them here would show the operator a preview the dispatch then
 * contradicts. See design.md Decision 3.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request, requestData } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/** Why the server refused an order. A closed set, so the UI can group refusals. */
export type CourierIneligibleReason =
  | 'NOT_PACKED'
  | 'ALREADY_DISPATCHED'
  | 'NO_SHIPPING_ADDRESS'
  | 'NO_RECIPIENT_NAME'
  | 'NAME_TOO_LONG'
  | 'INVALID_PHONE'
  | 'ADDRESS_TOO_LONG'

/**
 * What happened to one order.
 *
 * `failed` and `unconfirmed` are separate and must stay that way. A failed order
 * definitely has no consignment and is safe to send again; an unconfirmed one
 * may already have one nobody has seen, and retrying it is how a merchant pays
 * for two pickups of one parcel. The result UI offers retry for the first only.
 */
export type CourierDispatchOutcome = 'dispatched' | 'ineligible' | 'failed' | 'unconfirmed'

export interface CourierEligibility {
  orderId: string
  orderNumber: string
  eligible: boolean
  reason?: CourierIneligibleReason
  detail?: string
  consignmentId?: string | null
  trackingCode?: string | null
}

export interface CourierDispatchResult {
  orderId: string
  orderNumber: string
  outcome: CourierDispatchOutcome
  reason?: CourierIneligibleReason
  detail?: string
  consignmentId?: string | null
  trackingCode?: string | null
}

export interface CourierDispatchSummary {
  dispatched: number
  ineligible: number
  failed: number
  unconfirmed: number
  results: CourierDispatchResult[]
}

export interface CourierBalance {
  currentBalance: number
}

async function previewDispatch(orderIds: string[]): Promise<CourierEligibility[]> {
  return requestData<CourierEligibility[]>('/courier/dispatch/preview', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  })
}

async function dispatchOrders(orderIds: string[]): Promise<CourierDispatchSummary> {
  const res = await request<CourierDispatchSummary>('/courier/dispatch', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  })
  return res.data
}

async function getBalance(): Promise<CourierBalance> {
  return requestData<CourierBalance>('/courier/balance')
}

async function createReturnRequest(orderId: string, reason?: string): Promise<unknown> {
  return requestData<unknown>(`/courier/orders/${orderId}/return`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  })
}

/**
 * The preview is a mutation, not a query.
 *
 * It takes a body, it is asked for on demand rather than kept fresh, and caching
 * it would be actively wrong — eligibility changes the moment someone packs an
 * order or edits an address.
 */
export function usePreviewDispatch() {
  return useMutation({ mutationFn: (orderIds: string[]) => previewDispatch(orderIds) })
}

export function useDispatchOrders() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (orderIds: string[]) => dispatchOrders(orderIds),
    onSuccess: (summary) => {
      // The list is refreshed whatever happened: even a wholly failed dispatch
      // may have advanced nothing, and showing stale rows after the operator
      // acted reads as the action having been ignored.
      client.invalidateQueries({ queryKey: queryKeys.orders.all })

      for (const result of summary.results) {
        if (result.outcome !== 'dispatched') continue
        client.invalidateQueries({ queryKey: queryKeys.orders.detail(result.orderId) })
        client.invalidateQueries({ queryKey: queryKeys.shipments.byOrder(result.orderId) })
      }
    },
  })
}

/** Single-order dispatch reuses the bulk endpoint, so the outcomes are identical. */
export function useDispatchSingleOrder() {
  const dispatch = useDispatchOrders()
  return {
    ...dispatch,
    mutateAsync: (orderId: string) => dispatch.mutateAsync([orderId]),
  }
}

/**
 * Balance is fetched on demand rather than on mount.
 *
 * It is a live call to Steadfast on every request, so putting it behind an
 * `enabled` flag keeps a page that merely renders the widget from calling their
 * API each time it opens.
 */
export function useCourierBalance(enabled = false) {
  return useQuery({
    queryKey: queryKeys.courier.balance,
    queryFn: getBalance,
    enabled,
    // Their balance moves with every delivery; a cached figure would be a
    // number that looks current and is not.
    staleTime: 0,
    retry: false,
  })
}

export function useCreateCourierReturn() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      createReturnRequest(orderId, reason),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.shipments.byOrder(variables.orderId) })
    },
  })
}
