/** Real backend supplier calls — follows the same envelope/error pattern as `categories.ts`/`products.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export interface Supplier {
  id: string
  name: string
  companyName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierInput {
  name: string
  companyName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  isActive?: boolean
}

export interface SupplierListParams extends ListParams {
  isActive?: boolean
  country?: string
}

async function listSuppliers(params: SupplierListParams = {}): Promise<PaginatedResponse<Supplier>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive))
  if (params.country) query.set('country', params.country)

  const res = await request<Supplier[]>(`/suppliers?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getSupplier(id: string): Promise<Supplier> {
  const res = await request<Supplier>(`/suppliers/${id}`)
  return res.data
}

async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const res = await request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const res = await request<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteSupplier(id: string): Promise<void> {
  await request<Supplier>(`/suppliers/${id}`, { method: 'DELETE' })
}

export function useSuppliers(params: SupplierListParams = {}) {
  return useQuery({ queryKey: queryKeys.suppliers.list(params), queryFn: () => listSuppliers(params) })
}

/** Reads one supplier by id — what the edit page needs when it is opened by URL. */
export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id ?? ''),
    queryFn: () => getSupplier(id!),
    enabled: Boolean(id),
  })
}

export function useCreateSupplier() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createSupplier, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.suppliers.all }) })
}

export function useUpdateSupplier() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SupplierInput }) => updateSupplier(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
  })
}

export function useDeleteSupplier() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteSupplier, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.suppliers.all }) })
}
