/** Real backend stock calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

interface StockEntityRef {
  id: string
  name: string
  sku: string
}

interface StockWarehouseRef {
  id: string
  name: string
  code: string
}

export interface StockRecord {
  id: string
  productId: string
  variantId: string | null
  warehouseId: string
  quantity: number
  reservedQuantity: number
  product: StockEntityRef
  variant: StockEntityRef | null
  warehouse: StockWarehouseRef
  createdAt: string
  updatedAt: string
}

export interface StockRow extends StockRecord {
  available: number
}

export interface StockListParams extends ListParams {
  warehouseId?: string
  productId?: string
  variantId?: string
}

function toRow(record: StockRecord): StockRow {
  return { ...record, available: record.quantity - record.reservedQuantity }
}

async function listStock(params: StockListParams = {}): Promise<PaginatedResponse<StockRow>> {
  const limit = params.limit ?? 100

  // No `searchTerm` — GET /stock has no free-text search, only these filters (see design.md).
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.warehouseId) query.set('warehouseId', params.warehouseId)
  if (params.productId) query.set('productId', params.productId)
  if (params.variantId) query.set('variantId', params.variantId)

  const res = await request<StockRecord[]>(`/stock?${query}`)
  const rows = res.data.map(toRow)
  return {
    data: rows,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: rows.length, totalPages: 1 },
  }
}

async function adjustStock(id: string, quantityDelta: number, note: string): Promise<StockRow> {
  const res = await request<StockRecord>(`/stock/${id}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify({ quantityDelta, note }),
  })
  return toRow(res.data)
}

async function reassignStockVariant(
  id: string,
  variantId: string,
  quantity: number,
  note?: string,
): Promise<StockRow> {
  const res = await request<StockRecord>(`/stock/${id}/reassign-variant`, {
    method: 'PATCH',
    body: JSON.stringify({ variantId, quantity, note }),
  })
  return toRow(res.data)
}

export function useStock(params: StockListParams = {}) {
  return useQuery({ queryKey: queryKeys.stock.list(params), queryFn: () => listStock(params) })
}

export function useAdjustStock() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantityDelta, note }: { id: string; quantityDelta: number; note: string }) => adjustStock(id, quantityDelta, note),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}

export function useReassignStockVariant() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, variantId, quantity, note }: { id: string; variantId: string; quantity: number; note?: string }) =>
      reassignStockVariant(id, variantId, quantity, note),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
      // The variant and product mirrors the storefront reads have moved, so the
      // catalogue's stock figures are stale until refetched.
      client.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
