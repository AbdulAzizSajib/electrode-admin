/**
 * Named delivery policies made of places, assigned to products. A place carries
 * the destination it covers, what it costs to ship there, how long it takes,
 * and optionally collection in person. See `admin/catalog-rules`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export interface ShippingPlace {
  id: string
  shippingRuleId: string
  name: string | null
  /** Null means every country — with `state` also null, that is the catch-all. */
  country: string | null
  /** Null means every region in `country`. Meaningless without one. */
  state: string | null
  price: string
  deliveryDays: number
  offersPickup: boolean
  pickupPrice: string
}

export interface ShippingRule {
  id: string
  name: string
  places: ShippingPlace[]
  createdAt: string
  updatedAt: string
}

export interface ShippingPlaceInput {
  id?: string
  name?: string
  country?: string
  state?: string
  price: number
  deliveryDays?: number
  offersPickup?: boolean
  pickupPrice?: number
}

export interface ShippingRuleInput {
  name: string
  /** At least one, always — a rule matching nowhere can charge nothing. */
  places: ShippingPlaceInput[]
}

async function listShippingRules(
  params: ListParams = {},
): Promise<PaginatedResponse<ShippingRule>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<ShippingRule[]>(`/shipping-rules?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function listAllShippingRules(): Promise<ShippingRule[]> {
  const res = await request<ShippingRule[]>('/shipping-rules/all')
  return res.data
}

async function getShippingRule(id: string): Promise<ShippingRule> {
  const res = await request<ShippingRule>(`/shipping-rules/${id}`)
  return res.data
}

async function createShippingRule(input: ShippingRuleInput): Promise<ShippingRule> {
  const res = await request<ShippingRule>('/shipping-rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateShippingRule(
  id: string,
  input: Partial<ShippingRuleInput>,
): Promise<ShippingRule> {
  const res = await request<ShippingRule>(`/shipping-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/** Same reassign-before-delete contract as tax rules: a product must be deliverable. */
async function deleteShippingRule(id: string, reassignToId?: string): Promise<void> {
  const suffix = reassignToId ? `?reassign_to=${encodeURIComponent(reassignToId)}` : ''
  await request<unknown>(`/shipping-rules/${id}${suffix}`, { method: 'DELETE' })
}

export function useShippingRules(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.shippingRules.list(params),
    queryFn: () => listShippingRules(params),
  })
}

export function useAllShippingRules() {
  return useQuery({ queryKey: queryKeys.shippingRules.all, queryFn: listAllShippingRules })
}

export function useShippingRule(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shippingRules.detail(id ?? ''),
    queryFn: () => getShippingRule(id as string),
    enabled: !!id,
  })
}

export function useCreateShippingRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createShippingRule,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingRules.all }),
  })
}

export function useUpdateShippingRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ShippingRuleInput> }) =>
      updateShippingRule(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.shippingRules.all }),
  })
}

export function useDeleteShippingRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) =>
      deleteShippingRule(id, reassignToId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.shippingRules.all })
      void client.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
