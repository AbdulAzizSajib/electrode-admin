/** Real backend role calls — OWNER-only, like every route under `/roles`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { Permission } from '@/lib/api/permissions'

/** A row of the `RolePermission` join, with the permission it points at. */
export interface RolePermission {
  id: string
  roleId: string
  permissionId: string
  permission: Permission
  createdAt: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  /** The join rows, not a bare id array — granting and revoking are separate endpoints. */
  permissions: RolePermission[]
  createdAt: string
  updatedAt: string
}

export interface RoleInput {
  name: string
  description?: string
}

async function listRoles(params: ListParams = {}): Promise<PaginatedResponse<Role>> {
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)

  const res = await request<Role[]>(`/roles?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getRole(id: string): Promise<Role> {
  const res = await request<Role>(`/roles/${id}`)
  return res.data
}

async function createRole(input: RoleInput): Promise<Role> {
  const res = await request<Role>('/roles', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateRole(id: string, input: RoleInput): Promise<Role> {
  const res = await request<Role>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

/**
 * Deleting a role the backend still considers in use returns a conflict with a message. There is
 * deliberately no client-side pre-check: the mock kept its own `_isRoleInUse` guess, which could
 * disagree with the server. Surfacing the backend's own reason is what the other modules do too.
 */
async function deleteRole(id: string): Promise<void> {
  await request<Role>(`/roles/${id}`, { method: 'DELETE' })
}

/** Both grant and revoke return the refreshed role, so the displayed state is the server's. */
async function grantPermission(roleId: string, permissionId: string): Promise<Role> {
  const res = await request<Role>(`/roles/${roleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissionId }),
  })
  return res.data
}

async function revokePermission(roleId: string, permissionId: string): Promise<Role> {
  const res = await request<Role>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })
  return res.data
}

/**
 * `enabled` exists because `/roles` is OWNER-only: a non-OWNER page that wants the role list for a
 * picker should skip the request rather than fire one that comes back 403.
 */
export function useRoles(params: ListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => listRoles(params),
    enabled: options.enabled ?? true,
  })
}

export function useRole(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.roles.detail(id ?? ''), queryFn: () => getRole(id!), enabled: !!id })
}

export function useCreateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useUpdateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RoleInput }) => updateRole(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useDeleteRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useGrantPermission() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      grantPermission(roleId, permissionId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useRevokePermission() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      revokePermission(roleId, permissionId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}
