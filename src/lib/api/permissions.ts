import { useQuery } from '@tanstack/react-query'
import { delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'

export interface Permission {
  id: string
  key: string
  label: string
  category: string
}

const permissions: Permission[] = [
  { id: generateId('perm'), key: 'catalog.read', label: 'View catalog', category: 'Catalog' },
  { id: generateId('perm'), key: 'catalog.write', label: 'Manage catalog', category: 'Catalog' },
  { id: generateId('perm'), key: 'inventory.read', label: 'View inventory', category: 'Inventory' },
  { id: generateId('perm'), key: 'inventory.write', label: 'Manage inventory', category: 'Inventory' },
  { id: generateId('perm'), key: 'orders.read', label: 'View orders', category: 'Sales' },
  { id: generateId('perm'), key: 'orders.write', label: 'Manage orders', category: 'Sales' },
  { id: generateId('perm'), key: 'marketing.write', label: 'Manage marketing', category: 'Marketing' },
  { id: generateId('perm'), key: 'customers.read', label: 'View customers', category: 'Customers' },
  { id: generateId('perm'), key: 'support.write', label: 'Manage support tickets', category: 'Support' },
  { id: generateId('perm'), key: 'settings.write', label: 'Manage store settings', category: 'Settings' },
  { id: generateId('perm'), key: 'roles.write', label: 'Manage roles & permissions', category: 'Settings' },
]

export function _getAllPermissions() {
  return permissions
}

async function listPermissions(params: ListParams = {}): Promise<PaginatedResponse<Permission>> {
  return delay(paginate(permissions, { ...params, limit: params.limit ?? 100 }))
}

export function usePermissions(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.permissions.list(params), queryFn: () => listPermissions(params) })
}
