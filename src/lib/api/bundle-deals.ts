/**
 * "Buy N, get M free" offers a product can carry. See `admin/product-grouping`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export interface BundleDeal {
  id: string
  name: string
  buyQuantity: number
  freeQuantity: number
  createdAt: string
  updatedAt: string
}

export interface BundleDealInput {
  name: string
  /** Both at least one — an offer giving nothing away is not an offer. */
  buyQuantity: number
  freeQuantity: number
}

async function listBundleDeals(params: ListParams = {}): Promise<PaginatedResponse<BundleDeal>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<BundleDeal[]>(`/bundle-deals?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function listAllBundleDeals(): Promise<BundleDeal[]> {
  const res = await request<BundleDeal[]>('/bundle-deals/all')
  return res.data
}

async function getBundleDeal(id: string): Promise<BundleDeal> {
  const res = await request<BundleDeal>(`/bundle-deals/${id}`)
  return res.data
}

async function createBundleDeal(input: BundleDealInput): Promise<BundleDeal> {
  const res = await request<BundleDeal>('/bundle-deals', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateBundleDeal(id: string, input: Partial<BundleDealInput>): Promise<BundleDeal> {
  const res = await request<BundleDeal>(`/bundle-deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/**
 * `force` confirms deleting an offer products still carry — they are then sold
 * without one. The backend refuses with a 409 and a count until it is sent,
 * because losing an offer is a commercial consequence a merchant should not
 * learn about from a customer.
 */
async function deleteBundleDeal(id: string, force?: boolean): Promise<void> {
  await request<unknown>(`/bundle-deals/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' })
}

export function useBundleDeals(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.bundleDeals.list(params),
    queryFn: () => listBundleDeals(params),
  })
}

export function useAllBundleDeals() {
  return useQuery({ queryKey: queryKeys.bundleDeals.all, queryFn: listAllBundleDeals })
}

export function useBundleDeal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bundleDeals.detail(id ?? ''),
    queryFn: () => getBundleDeal(id as string),
    enabled: !!id,
  })
}

export function useCreateBundleDeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createBundleDeal,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.bundleDeals.all }),
  })
}

export function useUpdateBundleDeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<BundleDealInput> }) =>
      updateBundleDeal(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.bundleDeals.all }),
  })
}

export function useDeleteBundleDeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => deleteBundleDeal(id, force),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.bundleDeals.all })
      void client.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
