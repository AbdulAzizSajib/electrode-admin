/** Real backend shipment calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. One shipment per order: `POST` 409s if one exists, `PATCH` 404s if none does. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type PaginationMeta } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import type { ShippingMethod } from '@/lib/api/shipping-methods'

export type ShipmentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'

export interface Shipment {
  id: string
  orderId: string
  shippingMethodId: string | null
  shippingMethod: ShippingMethod | null
  trackingNumber: string | null
  carrier: string | null
  status: ShipmentStatus
  shippedAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ShipmentInput {
  shippingMethodId?: string
  trackingNumber?: string
  carrier?: string
  status?: ShipmentStatus
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message ?? `Request to ${path} failed`, res.status)
  }
  return json
}

async function getShipmentByOrder(orderId: string): Promise<Shipment | null> {
  try {
    const res = await request<Shipment>(`/orders/${orderId}/shipment`)
    return res.data
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** Creates the order's shipment if it has none yet, otherwise updates the existing one. */
async function upsertShipment(orderId: string, input: ShipmentInput, hasExisting: boolean): Promise<Shipment> {
  const res = await request<Shipment>(`/orders/${orderId}/shipment`, {
    method: hasExisting ? 'PATCH' : 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

export function useShipmentByOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shipments.byOrder(orderId ?? ''),
    queryFn: () => getShipmentByOrder(orderId!),
    enabled: !!orderId,
  })
}

export function useUpsertShipment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, input, hasExisting }: { orderId: string; input: ShipmentInput; hasExisting: boolean }) =>
      upsertShipment(orderId, input, hasExisting),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.shipments.byOrder(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
