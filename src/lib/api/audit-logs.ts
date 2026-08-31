/** Real backend audit-log calls — follows the same envelope/error pattern as `categories.ts`. */
import { useQuery } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'APPROVE',
  'REJECT',
  'CANCEL',
  'REFUND',
  'EXPORT',
  'IMPORT',
  'OTHER',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** The acting user, or null when the account has since been deleted (`onDelete: SetNull`). */
export interface AuditActor {
  id: string
  name: string
  email: string
}

export interface AuditLogEntry {
  id: string
  userId: string | null
  user: AuditActor | null
  action: AuditAction
  /** The model name the action touched, e.g. "StoreSetting" — replaces the mock's `resourceType`. */
  entity: string
  entityId: string | null
  /** Recorded before/after state. Shape varies by entity, so it stays opaque and is rendered as JSON. */
  oldData: unknown
  newData: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface AuditLogListParams extends ListParams {
  action?: AuditAction
  entity?: string
  entityId?: string
  userId?: string
  /** Inclusive lower bound, ISO date or datetime. */
  from?: string
  /** Inclusive upper bound, ISO date or datetime. */
  to?: string
}

async function listAuditLogs(params: AuditLogListParams = {}): Promise<PaginatedResponse<AuditLogEntry>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.action) query.set('action', params.action)
  if (params.entity) query.set('entity', params.entity)
  if (params.entityId) query.set('entityId', params.entityId)
  if (params.userId) query.set('userId', params.userId)
  // The backend's range-filter syntax, parsed by its QueryBuilder into a Prisma gte/lte filter.
  // `to` is pushed to the end of the chosen day so a same-day from/to range is inclusive rather
  // than matching only entries stamped exactly midnight.
  if (params.from) query.set('createdAt[gte]', new Date(`${params.from}T00:00:00.000Z`).toISOString())
  if (params.to) query.set('createdAt[lte]', new Date(`${params.to}T23:59:59.999Z`).toISOString())

  const res = await request<AuditLogEntry[]>(`/audit-logs?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

export function useAuditLogs(params: AuditLogListParams = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => listAuditLogs(params),
  })
}
