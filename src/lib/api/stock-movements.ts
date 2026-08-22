import { useQuery } from '@tanstack/react-query'
import { delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export type StockMovementType = 'purchase_receipt' | 'adjustment' | 'return_restock' | 'sale'

export interface StockMovement {
  id: string
  productId: string
  productName: string
  warehouseId: string
  warehouseName: string
  type: StockMovementType
  quantityDelta: number
  balanceAfter: number
  reason?: string
  createdAt: string
}

let movements: StockMovement[] = []

export function _recordStockMovement(entry: Omit<StockMovement, 'id' | 'createdAt'>) {
  const movement: StockMovement = { id: generateId('mov'), createdAt: new Date().toISOString(), ...entry }
  movements = [movement, ...movements]
  return movement
}

export interface StockMovementListParams extends ListParams {
  productId?: string
  warehouseId?: string
  type?: StockMovementType
}

async function listStockMovements(params: StockMovementListParams = {}): Promise<PaginatedResponse<StockMovement>> {
  let filtered = [...movements]
  if (params.productId) filtered = filtered.filter((m) => m.productId === params.productId)
  if (params.warehouseId) filtered = filtered.filter((m) => m.warehouseId === params.warehouseId)
  if (params.type) filtered = filtered.filter((m) => m.type === params.type)
  return delay(paginate(filtered, params))
}

export function useStockMovements(params: StockMovementListParams = {}) {
  return useQuery({ queryKey: queryKeys.stockMovements.list(params), queryFn: () => listStockMovements(params) })
}
