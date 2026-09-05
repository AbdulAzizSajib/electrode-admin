/** Real backend purchase-order calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Supplier } from '@/lib/api/suppliers'
import type { SettlementState } from '@/lib/api/supplier-payments'

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

interface PurchaseOrderItemProductRef {
  id: string
  name: string
  sku: string
}

export interface PurchaseOrderLineItem {
  id: string
  productId: string
  product: PurchaseOrderItemProductRef
  quantity: number
  receivedQuantity: number
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  unitCost: string
  /** Decimal column — arrives as a string from the API. */
  totalCost: string
}

export interface PurchaseOrder {
  id: string
  purchaseNumber: string
  supplierId: string
  supplier: Supplier
  status: PurchaseOrderStatus
  items: PurchaseOrderLineItem[]
  /** Decimal column — arrives as a string from the API. */
  subtotal: string
  /** Decimal column — arrives as a string from the API. */
  shippingCost: string
  /** Decimal column — arrives as a string from the API. */
  taxAmount: string
  /** Decimal column — arrives as a string from the API. */
  totalAmount: string
  notes: string | null
  orderedAt: string | null
  receivedAt: string | null
  createdAt: string
  updatedAt: string
  /**
   * Settlement figures, computed server-side from SupplierPayment rows on
   * every read — they are numbers, not Decimal strings, because the server
   * rounds them rather than passing a column through. Never stored, so they
   * cannot drift from the payments they describe.
   */
  amountPaid: number
  balanceDue: number
  settlementState: SettlementState
}

export interface PurchaseOrderCreateInput {
  supplierId: string
  items: Array<{ productId: string; quantity: number; unitCost: number }>
  shippingCost?: number
  taxAmount?: number
  notes?: string
  orderedAt?: string
}

/** Line items aren't editable via update — only these scalar fields, plus a pre-receipt status transition. */
export interface PurchaseOrderUpdateInput {
  shippingCost?: number
  taxAmount?: number
  notes?: string
  orderedAt?: string
  status?: 'DRAFT' | 'ORDERED' | 'CANCELLED'
}

export interface PurchaseOrderReceiveInput {
  warehouseId: string
  items: Array<{ purchaseOrderItemId: string; quantity: number }>
}

export interface PurchaseOrderListParams extends ListParams {
  status?: PurchaseOrderStatus
  supplierId?: string
  /** Narrows to purchase orders that still owe money. Not a plain column filter — the server compares the total against the sum of its payments. */
  hasBalance?: boolean
}

async function listPurchaseOrders(params: PurchaseOrderListParams = {}): Promise<PaginatedResponse<PurchaseOrder>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)
  if (params.supplierId) query.set('supplierId', params.supplierId)
  if (params.hasBalance) query.set('hasBalance', 'true')

  const res = await request<PurchaseOrder[]>(`/purchase-orders?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await request<PurchaseOrder>(`/purchase-orders/${id}`)
  return res.data
}

async function createPurchaseOrder(input: PurchaseOrderCreateInput): Promise<PurchaseOrder> {
  const res = await request<PurchaseOrder>('/purchase-orders', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updatePurchaseOrder(id: string, input: PurchaseOrderUpdateInput): Promise<PurchaseOrder> {
  const res = await request<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deletePurchaseOrder(id: string): Promise<void> {
  await request<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'DELETE' })
}

async function receivePurchaseOrder(id: string, input: PurchaseOrderReceiveInput): Promise<PurchaseOrder> {
  const res = await request<PurchaseOrder>(`/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(input) })
  return res.data
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
    mutationFn: ({ id, input }: { id: string; input: PurchaseOrderUpdateInput }) => updatePurchaseOrder(id, input),
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
    mutationFn: ({ id, input }: { id: string; input: PurchaseOrderReceiveInput }) => receivePurchaseOrder(id, input),
    onSuccess: (_d, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      client.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(variables.id) })
      client.invalidateQueries({ queryKey: queryKeys.stock.all })
      client.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
    },
  })
}
