/** Real backend stock calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, BASE_URL, type ListParams, type PaginatedResponse, type PaginationMeta } from '@/lib/api/client'
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
