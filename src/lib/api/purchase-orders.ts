import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _recordStockMovement } from '@/lib/api/stock-movements'
import { _restockWarehouse } from '@/lib/api/stock'
import { _getAllProducts } from '@/lib/api/products'
import { _getAllSuppliers } from '@/lib/api/suppliers'
import { _getAllWarehouses } from '@/lib/api/warehouses'

export type PurchaseOrderStatus = 'pending' | 'partially_received' | 'received' | 'cancelled'

export interface PurchaseOrderLineItem {
  productId: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  warehouseId: string
  status: PurchaseOrderStatus
  items: PurchaseOrderLineItem[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderInput {
  supplierId: string
  warehouseId: string
  items: Array<{ productId: string; quantityOrdered: number; unitCost: number }>
  notes?: string
}

let poSequence = 1042
let purchaseOrders: PurchaseOrder[] = []

function seed() {
  const suppliers = _getAllSuppliers()
  const warehouses = _getAllWarehouses()
  const products = _getAllProducts()
  if (!suppliers.length || !warehouses.length || !products.length) return

  const now = new Date().toISOString()
  purchaseOrders = [
    {
      id: generateId('po'),
      poNumber: `PO-${poSequence++}`,
      supplierId: suppliers[0].id,
      warehouseId: warehouses[0].id,
      status: 'received',
      items: [
        { productId: products[0].id, quantityOrdered: 100, quantityReceived: 100, unitCost: 62.5 },
        { productId: products[3].id, quantityOrdered: 50, quantityReceived: 50, unitCost: 110 },
      ],
      createdAt: '2025-12-01T09:00:00Z',
      updatedAt: '2025-12-05T09:00:00Z',
    },
    {
      id: generateId('po'),
      poNumber: `PO-${poSequence++}`,
      supplierId: suppliers[1].id,
      warehouseId: warehouses[1].id,
      status: 'partially_received',
      items: [{ productId: products[6].id, quantityOrdered: 200, quantityReceived: 120, unitCost: 38 }],
      createdAt: '2026-01-10T09:00:00Z',
      updatedAt: '2026-01-15T09:00:00Z',
    },
    {
      id: generateId('po'),
      poNumber: `PO-${poSequence++}`,
      supplierId: suppliers[2].id,
      warehouseId: warehouses[0].id,
      status: 'pending',
      items: [
        { productId: products[1].id, quantityOrdered: 30, quantityReceived: 0, unitCost: 720 },
        { productId: products[2].id, quantityOrdered: 40, quantityReceived: 0, unitCost: 540 },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]
}
seed()

export function poTotal(po: PurchaseOrder) {
  return po.items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0)
}

export function _isSupplierReferenced(supplierId: string) {
  return purchaseOrders.some((po) => po.supplierId === supplierId)
}

export interface PurchaseOrderListParams extends ListParams {
  status?: PurchaseOrderStatus
  supplierId?: string
}

async function listPurchaseOrders(params: PurchaseOrderListParams = {}): Promise<PaginatedResponse<PurchaseOrder>> {
  let filtered = [...purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (params.status) filtered = filtered.filter((po) => po.status === params.status)
  if (params.supplierId) filtered = filtered.filter((po) => po.supplierId === params.supplierId)
  if (params.search) {
    const needle = params.search.toLowerCase()
    filtered = filtered.filter((po) => po.poNumber.toLowerCase().includes(needle))
  }
  return delay(paginate(filtered, params))
}

async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const found = purchaseOrders.find((po) => po.id === id)
  if (!found) throw new ApiError('Purchase order not found', 404)
  return delay(found)
}

async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrder> {
  if (input.items.length === 0) throw new ApiError('Add at least one line item.', 422)
  const now = new Date().toISOString()
  const po: PurchaseOrder = {
    id: generateId('po'),
    poNumber: `PO-${poSequence++}`,
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    status: 'pending',
    items: input.items.map((i) => ({ ...i, quantityReceived: 0 })),
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }
  purchaseOrders = [po, ...purchaseOrders]
  recordAuditEntry({ action: 'purchase_order.created', resourceType: 'purchase_order', resourceId: po.id, resourceLabel: po.poNumber })
  return delay(po)
}

async function updatePurchaseOrder(id: string, input: PurchaseOrderInput): Promise<PurchaseOrder> {
  const index = purchaseOrders.findIndex((po) => po.id === id)
  if (index === -1) throw new ApiError('Purchase order not found', 404)
  if (purchaseOrders[index].status !== 'pending') {
    throw new ApiError('Only pending purchase orders can be edited.', 409)
  }
  const updated: PurchaseOrder = {
    ...purchaseOrders[index],
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    items: input.items.map((i) => ({ ...i, quantityReceived: 0 })),
    notes: input.notes,
    updatedAt: new Date().toISOString(),
  }
  purchaseOrders = purchaseOrders.map((po) => (po.id === id ? updated : po))
  recordAuditEntry({ action: 'purchase_order.updated', resourceType: 'purchase_order', resourceId: id, resourceLabel: updated.poNumber })
  return delay(updated)
}

async function deletePurchaseOrder(id: string): Promise<void> {
  const target = purchaseOrders.find((po) => po.id === id)
  if (!target) throw new ApiError('Purchase order not found', 404)
  const hasReceived = target.items.some((i) => i.quantityReceived > 0)
  if (hasReceived) throw new ApiError('Purchase orders with received quantity cannot be deleted.', 409)
  purchaseOrders = purchaseOrders.filter((po) => po.id !== id)
  recordAuditEntry({ action: 'purchase_order.deleted', resourceType: 'purchase_order', resourceId: id, resourceLabel: target.poNumber })
  return delay(undefined)
}

async function receivePurchaseOrder(id: string, receipts: Array<{ productId: string; quantity: number }>): Promise<PurchaseOrder> {
  const index = purchaseOrders.findIndex((po) => po.id === id)
  if (index === -1) throw new ApiError('Purchase order not found', 404)
  const po = purchaseOrders[index]
  const products = _getAllProducts()
  const warehouse = _getAllWarehouses().find((w) => w.id === po.warehouseId)

  const items = po.items.map((item) => {
    const receipt = receipts.find((r) => r.productId === item.productId)
    if (!receipt || receipt.quantity <= 0) return item
    const remaining = item.quantityOrdered - item.quantityReceived
    const receivedNow = Math.min(receipt.quantity, remaining)
    if (receivedNow <= 0) return item

    const newBalance = _restockWarehouse(item.productId, po.warehouseId, receivedNow)
    const product = products.find((p) => p.id === item.productId)
    _recordStockMovement({
      productId: item.productId,
      productName: product?.name ?? 'Unknown product',
      warehouseId: po.warehouseId,
      warehouseName: warehouse?.name ?? 'Unknown warehouse',
      type: 'purchase_receipt',
      quantityDelta: receivedNow,
      balanceAfter: newBalance,
      reason: `Received against ${po.poNumber}`,
    })

    return { ...item, quantityReceived: item.quantityReceived + receivedNow }
  })

  const allReceived = items.every((i) => i.quantityReceived >= i.quantityOrdered)
  const anyReceived = items.some((i) => i.quantityReceived > 0)
  const status: PurchaseOrderStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status

  const updated: PurchaseOrder = { ...po, items, status, updatedAt: new Date().toISOString() }
  purchaseOrders = purchaseOrders.map((p) => (p.id === id ? updated : p))
  recordAuditEntry({ action: 'purchase_order.received', resourceType: 'purchase_order', resourceId: id, resourceLabel: `${po.poNumber} (${status})` })
  return delay(updated)
}

export function usePurchaseOrders(params: PurchaseOrderListParams = {}) {
  return useQuery({ queryKey: queryKeys.purchaseOrders.list(params), queryFn: () => listPurchaseOrders(params) })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id ?? ''),
    queryFn: () => getPurchaseOrder(id!),
    enabled: !!id,
  })
}

export function useCreatePurchaseOrder() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createPurchaseOrder, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }) })
}

export function useUpdatePurchaseOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PurchaseOrderInput }) => updatePurchaseOrder(id, input),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(variables.id) })
    },
  })
}

export function useDeletePurchaseOrder() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deletePurchaseOrder, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }) })
}

export function useReceivePurchaseOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, receipts }: { id: string; receipts: Array<{ productId: string; quantity: number }> }) =>
      receivePurchaseOrder(id, receipts),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(variables.id) })
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}
