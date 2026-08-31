/** Real backend warehouse calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export interface Warehouse {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  country: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WarehouseInput {
  name: string
  code: string
  address?: string
  city?: string
  country?: string
  isActive?: boolean
}

export interface WarehouseListParams extends ListParams {
  isActive?: boolean
  country?: string
}

async function listWarehouses(params: WarehouseListParams = {}): Promise<PaginatedResponse<Warehouse>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive))
  if (params.country) query.set('country', params.country)

  const res = await request<Warehouse[]>(`/warehouses?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  const res = await request<Warehouse>('/warehouses', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  const res = await request<Warehouse>(`/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteWarehouse(id: string): Promise<void> {
  await request<Warehouse>(`/warehouses/${id}`, { method: 'DELETE' })
}

export function useWarehouses(params: WarehouseListParams = {}) {
  return useQuery({ queryKey: queryKeys.warehouses.list(params), queryFn: () => listWarehouses(params) })
}

export function useCreateWarehouse() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createWarehouse, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.warehouses.all }) })
}

export function useUpdateWarehouse() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WarehouseInput }) => updateWarehouse(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
  })
}

export function useDeleteWarehouse() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteWarehouse, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.warehouses.all }) })
}
