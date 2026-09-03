/**
 * Named tax rules assigned to products, replacing the single shop-wide rate.
 * See `admin/catalog-rules`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export type ChargeType = 'FLAT' | 'PERCENT'

export interface TaxRule {
  id: string
  name: string
  type: ChargeType
  /** Decimals arrive as strings from the API. */
  value: string
  createdAt: string
  updatedAt: string
}

export interface TaxRuleInput {
  name: string
  type?: ChargeType
  value: number
}

async function listTaxRules(params: ListParams = {}): Promise<PaginatedResponse<TaxRule>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<TaxRule[]>(`/tax-rules?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function listAllTaxRules(): Promise<TaxRule[]> {
  const res = await request<TaxRule[]>('/tax-rules/all')
  return res.data
}

async function getTaxRule(id: string): Promise<TaxRule> {
  const res = await request<TaxRule>(`/tax-rules/${id}`)
  return res.data
}

async function createTaxRule(input: TaxRuleInput): Promise<TaxRule> {
  const res = await request<TaxRule>('/tax-rules', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateTaxRule(id: string, input: Partial<TaxRuleInput>): Promise<TaxRule> {
  const res = await request<TaxRule>(`/tax-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/**
 * A product must be taxable, so a rule in use cannot simply be removed: the
 * backend refuses with a 409 until `reassignToId` names where its products go,
 * and applies the move in the same transaction as the delete.
 */
async function deleteTaxRule(id: string, reassignToId?: string): Promise<void> {
  const suffix = reassignToId ? `?reassign_to=${encodeURIComponent(reassignToId)}` : ''
  await request<unknown>(`/tax-rules/${id}${suffix}`, { method: 'DELETE' })
}

export function useTaxRules(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.taxRules.list(params),
    queryFn: () => listTaxRules(params),
  })
}

export function useAllTaxRules() {
  return useQuery({ queryKey: queryKeys.taxRules.all, queryFn: listAllTaxRules })
}

export function useTaxRule(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.taxRules.detail(id ?? ''),
    queryFn: () => getTaxRule(id as string),
    enabled: !!id,
  })
}

export function useCreateTaxRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createTaxRule,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.taxRules.all }),
  })
}

export function useUpdateTaxRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaxRuleInput> }) =>
      updateTaxRule(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.taxRules.all }),
  })
}

export function useDeleteTaxRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) =>
      deleteTaxRule(id, reassignToId),
    // Products move to the replacement, so their cached rows are stale too.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.taxRules.all })
      void client.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
