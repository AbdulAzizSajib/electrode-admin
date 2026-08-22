import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export interface Supplier {
  id: string
  name: string
  contactEmail: string
  phone: string
  address: string
  createdAt: string
}

export interface SupplierInput {
  name: string
  contactEmail: string
  phone: string
  address: string
}

let suppliers: Supplier[] = [
  { id: generateId('sup'), name: 'Pacific Components Ltd.', contactEmail: 'sales@pacificcomponents.com', phone: '+1 213-555-0142', address: '900 Pier Ave, Los Angeles, CA', createdAt: '2025-08-01T09:00:00Z' },
  { id: generateId('sup'), name: 'Silverline Textiles', contactEmail: 'orders@silverlinetextiles.com', phone: '+1 704-555-0198', address: '221 Mill St, Charlotte, NC', createdAt: '2025-08-04T09:00:00Z' },
  { id: generateId('sup'), name: 'Home & Hearth Wholesale', contactEmail: 'wholesale@homehearth.com', phone: '+1 312-555-0177', address: '77 Commerce Dr, Chicago, IL', createdAt: '2025-08-10T09:00:00Z' },
]

export function _getAllSuppliers() {
  return suppliers
}

async function listSuppliers(params: ListParams = {}): Promise<PaginatedResponse<Supplier>> {
  const filtered = suppliers.filter((s) => matchesSearch([s.name, s.contactEmail], params.search))
  return delay(paginate(filtered, { ...params, limit: params.limit ?? 100 }))
}

async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const supplier: Supplier = { id: generateId('sup'), createdAt: new Date().toISOString(), ...input }
  suppliers = [supplier, ...suppliers]
  recordAuditEntry({ action: 'supplier.created', resourceType: 'supplier', resourceId: supplier.id, resourceLabel: supplier.name })
  return delay(supplier)
}

async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const index = suppliers.findIndex((s) => s.id === id)
  if (index === -1) throw new ApiError('Supplier not found', 404)
  const updated = { ...suppliers[index], ...input }
  suppliers = suppliers.map((s) => (s.id === id ? updated : s))
  recordAuditEntry({ action: 'supplier.updated', resourceType: 'supplier', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteSupplier(id: string, isReferenced: (id: string) => boolean): Promise<void> {
  if (isReferenced(id)) throw new ApiError('This supplier has purchase orders and cannot be deleted.', 409)
  const target = suppliers.find((s) => s.id === id)
  suppliers = suppliers.filter((s) => s.id !== id)
  recordAuditEntry({ action: 'supplier.deleted', resourceType: 'supplier', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

export function useSuppliers(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.suppliers.list(params), queryFn: () => listSuppliers(params) })
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

export function useDeleteSupplier(isReferenced: (id: string) => boolean) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id, isReferenced),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.suppliers.all }),
  })
}
