import type { ListParams } from '@/lib/api/client'

/**
 * Turns the shared `ListParams` into the query string the backend's
 * `QueryBuilder` expects.
 *
 * Every `src/lib/api/<resource>.ts` module was building this by hand, and the
 * copies had already drifted — some sent `search`, the backend reads
 * `searchTerm`; some sent an empty `searchTerm=` on every request, which the
 * builder then treats as a filter matching nothing. One place to get it wrong
 * is enough.
 *
 * The default limit is high because several callers ask for "all of them" to
 * fill a picker and pass no paging at all — the same convention brands.ts and
 * categories.ts already follow, for the same reason.
 */
export function buildListQuery(params: ListParams = {}, defaultLimit = 100) {
  const limit = params.limit ?? defaultLimit
  const query = new URLSearchParams()

  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  // Only when non-empty: a blank searchTerm is a filter that matches nothing,
  // not the absence of a filter.
  if (params.search) query.set('searchTerm', params.search)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)

  return { query, limit }
}
