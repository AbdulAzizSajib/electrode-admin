import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllPermissions } from '@/lib/api/permissions'
import { _getAllUsers } from '@/lib/api/users'

export interface Role {
  id: string
  name: string
  description: string
  permissionIds: string[]
  createdAt: string
}

export interface RoleInput {
  name: string
  description: string
}

function seedRoles(): Role[] {
  const perms = _getAllPermissions()
  const byKey = (key: string) => perms.find((p) => p.key === key)?.id
  return [
    { id: generateId('role'), name: 'Owner', description: 'Full access to every area of the store.', permissionIds: perms.map((p) => p.id), createdAt: '2025-01-01T09:00:00Z' },
    { id: generateId('role'), name: 'Store Admin', description: 'Manages catalog, orders, and marketing.', permissionIds: perms.filter((p) => p.category !== 'Settings').map((p) => p.id), createdAt: '2025-01-01T09:00:00Z' },
    { id: generateId('role'), name: 'Support Staff', description: 'Handles customer support and order lookups.', permissionIds: [byKey('orders.read'), byKey('customers.read'), byKey('support.write')].filter(Boolean) as string[], createdAt: '2025-01-01T09:00:00Z' },
  ]
}

let roles: Role[] = seedRoles()

export function _isRoleInUse(roleId: string) {
  const role = roles.find((r) => r.id === roleId)
  if (!role) return false
  return _getAllUsers().some((u) => u.role !== 'CUSTOMER' && u.role.toLowerCase() === role.name.toLowerCase().replace(/\s.*/, ''))
}

async function listRoles(params: ListParams = {}): Promise<PaginatedResponse<Role>> {
  return delay(paginate(roles, { ...params, limit: params.limit ?? 100 }))
}

async function getRole(id: string): Promise<Role> {
  const found = roles.find((r) => r.id === id)
  if (!found) throw new ApiError('Role not found', 404)
  return delay(found)
}

async function createRole(input: RoleInput): Promise<Role> {
  const role: Role = { id: generateId('role'), permissionIds: [], createdAt: new Date().toISOString(), ...input }
  roles = [role, ...roles]
  recordAuditEntry({ action: 'role.created', resourceType: 'role', resourceId: role.id, resourceLabel: role.name })
  return delay(role)
}

async function updateRole(id: string, input: RoleInput): Promise<Role> {
  const index = roles.findIndex((r) => r.id === id)
  if (index === -1) throw new ApiError('Role not found', 404)
  const updated = { ...roles[index], ...input }
  roles = roles.map((r) => (r.id === id ? updated : r))
  recordAuditEntry({ action: 'role.updated', resourceType: 'role', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteRole(id: string): Promise<void> {
  if (_isRoleInUse(id)) throw new ApiError('This role is assigned to one or more users and cannot be deleted.', 409)
  const target = roles.find((r) => r.id === id)
  roles = roles.filter((r) => r.id !== id)
  recordAuditEntry({ action: 'role.deleted', resourceType: 'role', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

async function togglePermission(roleId: string, permissionId: string): Promise<Role> {
  const index = roles.findIndex((r) => r.id === roleId)
  if (index === -1) throw new ApiError('Role not found', 404)
  const role = roles[index]
  const has = role.permissionIds.includes(permissionId)
  const updated = { ...role, permissionIds: has ? role.permissionIds.filter((p) => p !== permissionId) : [...role.permissionIds, permissionId] }
  roles = roles.map((r) => (r.id === roleId ? updated : r))
  recordAuditEntry({ action: has ? 'role.permission_removed' : 'role.permission_added', resourceType: 'role', resourceId: roleId, resourceLabel: role.name })
  return delay(updated)
}

export function useRoles(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.roles.list(params), queryFn: () => listRoles(params) })
}

export function useRole(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.roles.detail(id ?? ''), queryFn: () => getRole(id!), enabled: !!id })
}

function invalidateRoles(client: ReturnType<typeof useQueryClient>, id?: string) {
  client.invalidateQueries({ queryKey: queryKeys.roles.all })
  if (id) client.invalidateQueries({ queryKey: queryKeys.roles.detail(id) })
}

export function useCreateRole() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createRole, onSuccess: () => invalidateRoles(client) })
}

export function useUpdateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoleInput }) => updateRole(id, input),
    onSuccess: (_d, v) => invalidateRoles(client, v.id),
  })
}

export function useDeleteRole() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteRole, onSuccess: () => invalidateRoles(client) })
}

export function useTogglePermission() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) => togglePermission(roleId, permissionId),
    onSuccess: (_d, v) => invalidateRoles(client, v.roleId),
  })
}
