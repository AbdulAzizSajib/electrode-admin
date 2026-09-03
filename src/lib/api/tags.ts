/**
 * Product keywords, shared across the shop.
 *
 * There is deliberately no create call: a tag comes into existence by being
 * typed on a product and saved with it. A tag on nothing is a keyword for
 * nothing. See `admin/product-authoring` — "Keywords are reused rather than
 * reinvented".
 */
import { useQuery } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export interface Tag {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

async function listTags(params: ListParams = {}): Promise<PaginatedResponse<Tag>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<Tag[]>(`/tags?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function searchTags(term: string): Promise<Tag[]> {
  const res = await request<Tag[]>(`/tags/search?q=${encodeURIComponent(term)}`)
  return res.data
}

export function useTags(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.tags.list(params), queryFn: () => listTags(params) })
}

/**
 * Suggestions for the tag input. Skipped for a blank term — the endpoint
 * returns nothing for one anyway, and asking would be a request per keystroke
 * that can only come back empty.
 */
export function useTagSuggestions(term: string) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: queryKeys.tags.search(trimmed),
    queryFn: () => searchTags(trimmed),
    enabled: trimmed.length > 0,
    // Suggestions are advisory; a slightly stale list is better than a request
    // for every character typed.
    staleTime: 30_000,
  })
}
