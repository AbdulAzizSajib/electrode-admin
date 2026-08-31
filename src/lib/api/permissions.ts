/** Real backend permission calls — OWNER-only, like every route under `/permissions`. */
import { useQuery } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * The backend `Permission` model is `{ id, name, description }` — there is no `category`, so the
 * permission picker is a flat list rather than the grouped one the mock implied.
 */
export interface Permission {
  id: string
  name: string
  description: string | null
  createdAt: string
}

async function listPermissions(params: ListParams = {}): Promise<PaginatedResponse<Permission>> {
  // The roles page needs every permission at once to render its grant checkboxes, so the default
  // limit is high rather than the usual page size.
  const limit = params.limit ?? 100

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)

  const res = await request<Permission[]>(`/permissions?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

export function usePermissions(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.permissions.list(params), queryFn: () => listPermissions(params) })
}
