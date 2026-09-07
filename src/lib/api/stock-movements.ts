/** Real backend stock-movement calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. Read-only: movements are only ever created as a side effect of stock-adjust or purchase-order-receive, never directly. */
import { useQuery } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/** Kept in step with the same union in `@/lib/utils/stock-movement-labels`, which owns the labels and badge variants for these values. */
export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'CANCELLATION'

interface MovementEntityRef {
  id: string
  name: string
  sku: string
}

interface MovementWarehouseRef {
  id: string
  name: string
  code: string
}

export interface StockMovement {
  id: string
  productId: string
  variantId: string | null
  warehouseId: string | null
  type: StockMovementType
  quantity: number
  referenceId: string | null
  note: string | null
  product: MovementEntityRef
  variant: MovementEntityRef | null
  warehouse: MovementWarehouseRef | null
  createdAt: string
}

export interface StockMovementListParams extends ListParams {
  productId?: string
  variantId?: string
  warehouseId?: string
  type?: StockMovementType
}

async function listStockMovements(params: StockMovementListParams = {}): Promise<PaginatedResponse<StockMovement>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.productId) query.set('productId', params.productId)
  if (params.variantId) query.set('variantId', params.variantId)
  if (params.warehouseId) query.set('warehouseId', params.warehouseId)
  if (params.type) query.set('type', params.type)

  const res = await request<StockMovement[]>(`/stock-movements?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

export function useStockMovements(params: StockMovementListParams = {}) {
  return useQuery({ queryKey: queryKeys.stockMovements.list(params), queryFn: () => listStockMovements(params) })
}
