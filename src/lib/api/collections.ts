/**
 * Merchandising groupings independent of the category tree. A product belongs
 * to any number and keeps its category regardless. See `admin/product-grouping`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export interface Collection {
  id: string
  name: string
  slug: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export interface CollectionInput {
  name: string
  /** Derived from the name when omitted. */
  slug?: string
  isVisible?: boolean
}

async function listCollections(params: ListParams = {}): Promise<PaginatedResponse<Collection>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<Collection[]>(`/collections?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function listAllCollections(): Promise<Collection[]> {
  const res = await request<Collection[]>('/collections/all')
  return res.data
}

async function getCollection(id: string): Promise<Collection> {
  const res = await request<Collection>(`/collections/${id}`)
  return res.data
}

async function createCollection(input: CollectionInput): Promise<Collection> {
  const res = await request<Collection>('/collections', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateCollection(id: string, input: Partial<CollectionInput>): Promise<Collection> {
  const res = await request<Collection>(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/**
 * Needs no reassignment or confirmation: a product without a collection is
 * perfectly sellable, so only the memberships go.
 */
async function deleteCollection(id: string): Promise<void> {
  await request<unknown>(`/collections/${id}`, { method: 'DELETE' })
}

export function useCollections(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.collections.list(params),
    queryFn: () => listCollections(params),
  })
}

export function useAllCollections() {
  return useQuery({ queryKey: queryKeys.collections.all, queryFn: listAllCollections })
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id ?? ''),
    queryFn: () => getCollection(id as string),
    enabled: !!id,
  })
}

export function useCreateCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createCollection,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.collections.all }),
  })
}

export function useUpdateCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CollectionInput> }) =>
      updateCollection(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.collections.all }),
  })
}

export function useDeleteCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.collections.all }),
  })
}
