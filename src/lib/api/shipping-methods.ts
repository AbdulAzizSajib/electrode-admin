import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export interface ShippingMethod {
  id: string
  name: string
  description: string
  price: number
  isActive: boolean
  createdAt: string
}

export interface ShippingMethodInput {
  name: string
  description: string
  price: number
  isActive: boolean
}

let shippingMethods: ShippingMethod[] = [
  { id: generateId('ship'), name: 'Standard Shipping', description: '5-7 business days', price: 5.99, isActive: true, createdAt: '2025-07-01T09:00:00Z' },
  { id: generateId('ship'), name: 'Express Shipping', description: '2-3 business days', price: 14.99, isActive: true, createdAt: '2025-07-01T09:00:00Z' },
  { id: generateId('ship'), name: 'Overnight Shipping', description: 'Next business day', price: 29.99, isActive: true, createdAt: '2025-07-01T09:00:00Z' },
  { id: generateId('ship'), name: 'Local Pickup', description: 'Pick up in-store, free', price: 0, isActive: false, createdAt: '2025-07-05T09:00:00Z' },
]

export function _getAllShippingMethods() {
  return shippingMethods
}

async function listShippingMethods(params: ListParams = {}): Promise<PaginatedResponse<ShippingMethod>> {
  return delay(paginate(shippingMethods, { ...params, limit: params.limit ?? 100 }))
}

async function createShippingMethod(input: ShippingMethodInput): Promise<ShippingMethod> {
  const method: ShippingMethod = { id: generateId('ship'), createdAt: new Date().toISOString(), ...input }
  shippingMethods = [method, ...shippingMethods]
  recordAuditEntry({ action: 'shipping_method.created', resourceType: 'shipping_method', resourceId: method.id, resourceLabel: method.name })
  return delay(method)
}

async function updateShippingMethod(id: string, input: ShippingMethodInput): Promise<ShippingMethod> {
  const index = shippingMethods.findIndex((m) => m.id === id)
  if (index === -1) throw new ApiError('Shipping method not found', 404)
  const updated = { ...shippingMethods[index], ...input }
  shippingMethods = shippingMethods.map((m) => (m.id === id ? updated : m))
  recordAuditEntry({ action: 'shipping_method.updated', resourceType: 'shipping_method', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteShippingMethod(id: string, isReferenced: (id: string) => boolean): Promise<void> {
  if (isReferenced(id)) throw new ApiError('This shipping method is used by existing orders. Deactivate it instead.', 409)
  const target = shippingMethods.find((m) => m.id === id)
  shippingMethods = shippingMethods.filter((m) => m.id !== id)
  recordAuditEntry({ action: 'shipping_method.deleted', resourceType: 'shipping_method', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
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

export function useDeleteShippingMethod(isReferenced: (id: string) => boolean) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteShippingMethod(id, isReferenced),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingMethods.all }),
  })
}
