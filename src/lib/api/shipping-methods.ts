/** Real backend shipping-method calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export interface ShippingMethod {
  id: string
  name: string
  description: string | null
  /** Decimal column — arrives as a string from the API (see integrate-products-api design.md). */
  price: string
  estimatedDays: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ShippingMethodInput {
  name: string
  description?: string
  price: number
  estimatedDays?: number
  isActive?: boolean
}

async function listShippingMethods(params: ListParams = {}): Promise<PaginatedResponse<ShippingMethod>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)

  const res = await request<ShippingMethod[]>(`/shipping-methods/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function createShippingMethod(input: ShippingMethodInput): Promise<ShippingMethod> {
  const res = await request<ShippingMethod>('/shipping-methods', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateShippingMethod(id: string, input: ShippingMethodInput): Promise<ShippingMethod> {
  const res = await request<ShippingMethod>(`/shipping-methods/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteShippingMethod(id: string): Promise<void> {
  await request<ShippingMethod>(`/shipping-methods/${id}`, { method: 'DELETE' })
}

export function useShippingMethods(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.shippingMethods.list(params), queryFn: () => listShippingMethods(params) })
}

export function useCreateShippingMethod() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createShippingMethod, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingMethods.all }) })
}

export function useUpdateShippingMethod() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ShippingMethodInput }) => updateShippingMethod(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingMethods.all }),
  })
}

export function useDeleteShippingMethod() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteShippingMethod, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingMethods.all }) })
}
