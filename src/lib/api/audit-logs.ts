import { useQuery } from '@tanstack/react-query'
import { delay, paginate, generateId, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { useSessionStore } from '@/lib/store/session-store'

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  action: string
  resourceType: string
  resourceId?: string
  resourceLabel?: string
  createdAt: string
}

const auditLog: AuditLogEntry[] = [
  {
    id: generateId('audit'),
    actorId: 'mock-user-1',
    actorName: 'System',
    action: 'store.initialized',
    resourceType: 'store',
    resourceLabel: 'Ecom Admin',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
]

/**
 * Appends an audit trail entry. Called directly (not as a React hook) from mutating
 * actions across every capability's mock API module — see `platform-settings` spec's
 * Audit Log Viewer requirement.
 */
export function recordAuditEntry(entry: {
  action: string
  resourceType: string
  resourceId?: string
  resourceLabel?: string
}) {
  const actor = useSessionStore.getState().user
  auditLog.unshift({
    id: generateId('audit'),
    actorId: actor?.id ?? 'unknown',
    actorName: actor?.name ?? 'Unknown user',
    createdAt: new Date().toISOString(),
    ...entry,
  })
}

export interface AuditLogListParams extends ListParams {
  actorId?: string
  action?: string
  from?: string
  to?: string
}

async function listAuditLogs(params: AuditLogListParams = {}): Promise<PaginatedResponse<AuditLogEntry>> {
  let items = [...auditLog]
  if (params.actorId) items = items.filter((e) => e.actorId === params.actorId)
  if (params.action) items = items.filter((e) => e.action === params.action)
  if (params.from) items = items.filter((e) => e.createdAt >= params.from!)
  if (params.to) items = items.filter((e) => e.createdAt <= params.to!)
  return delay(paginate(items, params))
}

export function useAuditLogs(params: AuditLogListParams = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params),
    queryFn: () => listAuditLogs(params),
  })
}

export function useAuditActors() {
  return useQuery({
    queryKey: ['audit-logs', 'actors'],
    queryFn: () =>
      delay(
        Array.from(new Map(auditLog.map((e) => [e.actorId, e.actorName])).entries()).map(([id, name]) => ({
          id,
          name,
        })),
      ),
  })
}
