import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllOrders, _getOrderById } from '@/lib/api/orders'
import { _recordStockMovement } from '@/lib/api/stock-movements'
import { _restockWarehouse } from '@/lib/api/stock'
import { _getAllWarehouses } from '@/lib/api/warehouses'

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'completed'

export interface ReturnLineItem {
  productId: string
  productName: string
  quantity: number
}

export interface ReturnRequest {
  id: string
  orderId: string
  items: ReturnLineItem[]
  reason: string
  status: ReturnStatus
  restockedWarehouseId?: string
  createdAt: string
  updatedAt: string
}

let returns: ReturnRequest[] = []

function seed() {
  const delivered = _getAllOrders().filter((o) => o.fulfillmentStatus === 'delivered')
  const reasons = ['Item arrived damaged', 'Wrong item shipped', 'No longer needed', 'Item did not match description']
  delivered.slice(0, 3).forEach((order, i) => {
    const item = order.items[0]
    returns.push({
      id: generateId('ret'),
      orderId: order.id,
      items: [{ productId: item.productId, productName: item.productName, quantity: 1 }],
      reason: reasons[i % reasons.length],
      status: i === 0 ? 'completed' : i === 1 ? 'approved' : 'requested',
      restockedWarehouseId: i === 0 ? _getAllWarehouses()[0]?.id : undefined,
      createdAt: new Date(Date.now() - (i + 1) * 2 * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    })
  })
}
seed()

export interface ReturnListParams extends ListParams {
  status?: ReturnStatus
}

async function listReturns(params: ReturnListParams = {}) {
  const orders = _getAllOrders()
  let filtered = [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (params.status) filtered = filtered.filter((r) => r.status === params.status)
  const rows = filtered.map((r) => ({ ...r, orderNumber: orders.find((o) => o.id === r.orderId)?.orderNumber ?? '—' }))
  return delay(paginate(rows, params) as PaginatedResponse<(typeof rows)[number]>)
}

async function getReturn(id: string) {
  const found = returns.find((r) => r.id === id)
  if (!found) throw new ApiError('Return not found', 404)
  const order = _getOrderById(found.orderId)
  return delay({ ...found, orderNumber: order?.orderNumber ?? '—' })
}

async function updateReturnStatus(id: string, status: ReturnStatus, warehouseId?: string): Promise<ReturnRequest> {
  const index = returns.findIndex((r) => r.id === id)
  if (index === -1) throw new ApiError('Return not found', 404)
  const current = returns[index]

  if (status === 'completed') {
    if (!warehouseId) throw new ApiError('Select a warehouse to restock returned items.', 422)
    const warehouse = _getAllWarehouses().find((w) => w.id === warehouseId)
    for (const item of current.items) {
      const newBalance = _restockWarehouse(item.productId, warehouseId, item.quantity)
      _recordStockMovement({
        productId: item.productId,
        productName: item.productName,
        warehouseId,
        warehouseName: warehouse?.name ?? 'Unknown warehouse',
        type: 'return_restock',
        quantityDelta: item.quantity,
        balanceAfter: newBalance,
        reason: `Restocked from return ${id}`,
      })
    }
  }

  const updated: ReturnRequest = { ...current, status, restockedWarehouseId: warehouseId ?? current.restockedWarehouseId, updatedAt: new Date().toISOString() }
  returns = returns.map((r) => (r.id === id ? updated : r))
  recordAuditEntry({ action: 'return.status_updated', resourceType: 'return', resourceId: id, resourceLabel: `→ ${status}` })
  return delay(updated)
}

export function useReturns(params: ReturnListParams = {}) {
  return useQuery({ queryKey: queryKeys.returns.list(params), queryFn: () => listReturns(params) })
}

export function useReturn(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.returns.detail(id ?? ''), queryFn: () => getReturn(id!), enabled: !!id })
}

export function useUpdateReturnStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, warehouseId }: { id: string; status: ReturnStatus; warehouseId?: string }) =>
      updateReturnStatus(id, status, warehouseId),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.returns.all })
      client.invalidateQueries({ queryKey: queryKeys.returns.detail(variables.id) })
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}
