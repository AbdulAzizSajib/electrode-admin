import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _recordStockMovement } from '@/lib/api/stock-movements'
import { _getAllProducts } from '@/lib/api/products'
import { _getAllWarehouses } from '@/lib/api/warehouses'

export interface StockRecord {
  id: string
  productId: string
  warehouseId: string
  quantityOnHand: number
  reserved: number
  createdAt: string
}

export interface StockRow extends StockRecord {
  productName: string
  productSku: string
  warehouseName: string
  available: number
}

function seedStock(): StockRecord[] {
  const products = _getAllProducts()
  const warehouses = _getAllWarehouses().filter((w) => w.isActive)
  const records: StockRecord[] = []
  products.forEach((product, i) => {
    warehouses.forEach((warehouse, wi) => {
      const base = Math.round(product.stockQuantity * (wi === 0 ? 0.65 : 0.35))
      records.push({
        id: generateId('stk'),
        productId: product.id,
        warehouseId: warehouse.id,
        quantityOnHand: Math.max(0, base + ((i + wi) % 3)),
        reserved: (i + wi) % 4,
        createdAt: '2025-09-15T09:00:00Z',
      })
    })
  })
  return records
}

let stock: StockRecord[] = seedStock()

export function _getStockForProduct(productId: string) {
  return stock.filter((s) => s.productId === productId)
}

export function _restockWarehouse(productId: string, warehouseId: string, quantity: number) {
  const index = stock.findIndex((s) => s.productId === productId && s.warehouseId === warehouseId)
  if (index === -1) {
    stock = [...stock, { id: generateId('stk'), productId, warehouseId, quantityOnHand: quantity, reserved: 0, createdAt: new Date().toISOString() }]
    return quantity
  }
  const updated = { ...stock[index], quantityOnHand: stock[index].quantityOnHand + quantity }
  stock = stock.map((s) => (s.id === updated.id ? updated : s))
  return updated.quantityOnHand
}

export interface StockListParams extends ListParams {
  warehouseId?: string
  productId?: string
}

function toRow(record: StockRecord): StockRow {
  const product = _getAllProducts().find((p) => p.id === record.productId)
  const warehouse = _getAllWarehouses().find((w) => w.id === record.warehouseId)
  return {
    ...record,
    productName: product?.name ?? 'Unknown product',
    productSku: product?.sku ?? '—',
    warehouseName: warehouse?.name ?? 'Unknown warehouse',
    available: record.quantityOnHand - record.reserved,
  }
}

async function listStock(params: StockListParams = {}): Promise<PaginatedResponse<StockRow>> {
  let filtered = stock
  if (params.warehouseId) filtered = filtered.filter((s) => s.warehouseId === params.warehouseId)
  if (params.productId) filtered = filtered.filter((s) => s.productId === params.productId)
  const rows = filtered.map(toRow).filter((r) => !params.search || r.productName.toLowerCase().includes(params.search.toLowerCase()) || r.productSku.toLowerCase().includes(params.search.toLowerCase()))
  return delay(paginate(rows, params))
}

async function adjustStock(id: string, delta: number, reason: string): Promise<StockRow> {
  const index = stock.findIndex((s) => s.id === id)
  if (index === -1) throw new ApiError('Stock record not found', 404)
  if (!reason.trim()) throw new ApiError('A reason is required to adjust stock.', 422)
  const newQuantity = Math.max(0, stock[index].quantityOnHand + delta)
  const updated = { ...stock[index], quantityOnHand: newQuantity }
  stock = stock.map((s) => (s.id === id ? updated : s))
  const row = toRow(updated)
  _recordStockMovement({
    productId: row.productId,
    productName: row.productName,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    type: 'adjustment',
    quantityDelta: delta,
    balanceAfter: newQuantity,
    reason,
  })
  recordAuditEntry({ action: 'stock.adjusted', resourceType: 'stock', resourceId: id, resourceLabel: `${row.productName} @ ${row.warehouseName} (${delta > 0 ? '+' : ''}${delta})` })
  return delay(row)
}

export function useStock(params: StockListParams = {}) {
  return useQuery({ queryKey: queryKeys.stock.list(params), queryFn: () => listStock(params) })
}

export function useAdjustStock() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, delta, reason }: { id: string; delta: number; reason: string }) => adjustStock(id, delta, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}
