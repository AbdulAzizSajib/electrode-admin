/** Real backend staff-user calls — `GET /users` and `PATCH /users/:id`, OWNER/ADMIN only. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import type { User, UserStatus } from '@/lib/api/users'

export type StaffUserRow = User

export interface StaffUserListParams extends ListParams {
  roleId?: string
  status?: UserStatus
  isActive?: boolean
}

export interface StaffUserPatch {
  /**
   * OWNER-only on the backend: assigning a role is the same privilege `/roles` is gated on, so an
   * ADMIN attempting it gets a 403 with a message rather than a silent no-op.
   */
  roleId?: string
  status?: UserStatus
  isActive?: boolean
  name?: string
  contactNumber?: string
}

async function listStaffUsers(params: StaffUserListParams = {}): Promise<PaginatedResponse<StaffUserRow>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.roleId) query.set('roleId', params.roleId)
  if (params.status) query.set('status', params.status)
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive))

  const res = await request<StaffUserRow[]>(`/users?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getStaffUser(id: string): Promise<StaffUserRow> {
  const res = await request<StaffUserRow>(`/users/${id}`)
  return res.data
}

async function updateStaffUser(id: string, patch: StaffUserPatch): Promise<StaffUserRow> {
  const res = await request<StaffUserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  return res.data
}

export function useStaffUsers(params: StaffUserListParams = {}) {
  return useQuery({ queryKey: queryKeys.staffUsers.list(params), queryFn: () => listStaffUsers(params) })
}

/** Reads one staff user by id — what the edit page needs when it is opened by URL. */
export function useStaffUser(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.staffUsers.detail(id ?? ''),
    queryFn: () => getStaffUser(id!),
    enabled: Boolean(id),
  })
}

export function useUpdateStaffUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StaffUserPatch }) => updateStaffUser(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.staffUsers.all }),
  })
}
