import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export interface Warehouse {
  id: string
  name: string
  code: string
  address: string
  isActive: boolean
  createdAt: string
}

export interface WarehouseInput {
  name: string
  code: string
  address: string
  isActive: boolean
}

let warehouses: Warehouse[] = [
  { id: generateId('wh'), name: 'Main Distribution Center', code: 'WH-MAIN', address: '1200 Logistics Pkwy, Dallas, TX', isActive: true, createdAt: '2025-09-01T09:00:00Z' },
  { id: generateId('wh'), name: 'West Coast Fulfillment', code: 'WH-WEST', address: '88 Harbor Rd, Long Beach, CA', isActive: true, createdAt: '2025-09-05T09:00:00Z' },
  { id: generateId('wh'), name: 'Northeast Returns Hub', code: 'WH-NE-RET', address: '45 Industrial Ave, Newark, NJ', isActive: false, createdAt: '2025-09-10T09:00:00Z' },
]

export function _getAllWarehouses() {
  return warehouses
}

async function listWarehouses(params: ListParams = {}): Promise<PaginatedResponse<Warehouse>> {
  const filtered = warehouses.filter((w) => matchesSearch([w.name, w.code], params.search))
  return delay(paginate(filtered, { ...params, limit: params.limit ?? 100 }))
}

async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  const warehouse: Warehouse = { id: generateId('wh'), createdAt: new Date().toISOString(), ...input }
  warehouses = [warehouse, ...warehouses]
  recordAuditEntry({ action: 'warehouse.created', resourceType: 'warehouse', resourceId: warehouse.id, resourceLabel: warehouse.name })
  return delay(warehouse)
}

async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  const index = warehouses.findIndex((w) => w.id === id)
  if (index === -1) throw new ApiError('Warehouse not found', 404)
  const updated = { ...warehouses[index], ...input }
  warehouses = warehouses.map((w) => (w.id === id ? updated : w))
  recordAuditEntry({ action: 'warehouse.updated', resourceType: 'warehouse', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteWarehouse(id: string, isReferenced: (id: string) => boolean): Promise<void> {
  if (isReferenced(id)) {
    throw new ApiError('This warehouse has stock records. Deactivate it instead of deleting.', 409)
  }
  const target = warehouses.find((w) => w.id === id)
  warehouses = warehouses.filter((w) => w.id !== id)
  recordAuditEntry({ action: 'warehouse.deleted', resourceType: 'warehouse', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

export function useWarehouses(params: ListParams = {}) {
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

export function useDeleteWarehouse(isReferenced: (id: string) => boolean) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id, isReferenced),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
  })
}
