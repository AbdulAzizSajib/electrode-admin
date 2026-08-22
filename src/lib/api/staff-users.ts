import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'
import { _getAllUsers, _setUsers, type User, type UserRole } from '@/lib/api/users'

export type StaffRole = Exclude<UserRole, 'CUSTOMER'>

export interface StaffUserRow {
  id: string
  name: string
  email: string
  role: StaffRole
  isActive: boolean
  createdAt: string
}

function toRow(u: User): StaffUserRow {
  return { id: u.id, name: u.name, email: u.email, role: u.role as StaffRole, isActive: u.isActive, createdAt: u.createdAt }
}

async function listStaffUsers(params: ListParams = {}): Promise<PaginatedResponse<StaffUserRow>> {
  const staff = _getAllUsers().filter((u) => u.role !== 'CUSTOMER')
  const filtered = staff.filter((u) => matchesSearch([u.name, u.email], params.search))
  return delay(paginate(filtered.map(toRow), { ...params, limit: params.limit ?? 100 }))
}

async function updateStaffUser(id: string, patch: { role?: StaffRole; isActive?: boolean }): Promise<StaffUserRow> {
  const all = _getAllUsers()
  const index = all.findIndex((u) => u.id === id)
  if (index === -1) throw new ApiError('User not found', 404)
  const updated: User = { ...all[index], ...patch }
  const next = all.map((u) => (u.id === id ? updated : u))
  _setUsers(next)
  recordAuditEntry({ action: 'staff_user.updated', resourceType: 'user', resourceId: id, resourceLabel: `${updated.name} (${updated.role}${updated.isActive ? '' : ', inactive'})` })
  return delay(toRow(updated))
}

export function useStaffUsers(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.staffUsers.list(params), queryFn: () => listStaffUsers(params) })
}

export function useUpdateStaffUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: StaffRole; isActive?: boolean } }) => updateStaffUser(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.staffUsers.all }),
  })
}
