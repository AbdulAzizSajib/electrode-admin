import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _advanceOrderToShipped, _getAllOrders, _getOrderById } from '@/lib/api/orders'

export type ShipmentStatus = 'label_created' | 'in_transit' | 'delivered'

export interface Shipment {
  id: string
  orderId: string
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  createdAt: string
  updatedAt: string
}

let shipments: Shipment[] = []

function seed() {
  for (const order of _getAllOrders()) {
    if (order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'delivered') {
      shipments.push({
        id: generateId('shp'),
        orderId: order.id,
        carrier: ['UPS', 'FedEx', 'USPS'][Math.floor(Math.random() * 3)],
        trackingNumber: `1Z${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
        status: order.fulfillmentStatus === 'delivered' ? 'delivered' : 'in_transit',
        createdAt: order.createdAt,
        updatedAt: order.createdAt,
      })
    }
  }
}
seed()

async function getShipmentByOrder(orderId: string): Promise<Shipment | null> {
  return delay(shipments.find((s) => s.orderId === orderId) ?? null)
}

async function upsertShipment(orderId: string, carrier: string, trackingNumber: string): Promise<Shipment> {
  const order = _getOrderById(orderId)
  if (!order) throw new ApiError('Order not found', 404)

  const existingIndex = shipments.findIndex((s) => s.orderId === orderId)
  const now = new Date().toISOString()

  if (existingIndex >= 0) {
    const updated = { ...shipments[existingIndex], carrier, trackingNumber, updatedAt: now }
    shipments = shipments.map((s) => (s.orderId === orderId ? updated : s))
    recordAuditEntry({ action: 'shipment.updated', resourceType: 'shipment', resourceId: updated.id, resourceLabel: order.orderNumber })
    return delay(updated)
  }

  const shipment: Shipment = { id: generateId('shp'), orderId, carrier, trackingNumber, status: 'label_created', createdAt: now, updatedAt: now }
  shipments = [shipment, ...shipments]
  _advanceOrderToShipped(orderId)
  recordAuditEntry({ action: 'shipment.created', resourceType: 'shipment', resourceId: shipment.id, resourceLabel: order.orderNumber })
  return delay(shipment)
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
    mutationFn: ({ orderId, carrier, trackingNumber }: { orderId: string; carrier: string; trackingNumber: string }) =>
      upsertShipment(orderId, carrier, trackingNumber),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.shipments.byOrder(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) })
      client.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}
