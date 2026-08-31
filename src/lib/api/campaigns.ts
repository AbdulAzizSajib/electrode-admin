/** Real backend campaign calls — follows the same envelope/error pattern as `categories.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_PLACEMENTS = ['DEAL_OF_WEEK', 'FLASH_SALE'] as const
export type CampaignPlacement = (typeof CAMPAIGN_PLACEMENTS)[number]

/** Badge styling per status, shared by the campaign list and detail pages. */
export const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  SCHEDULED: 'warning',
  PAUSED: 'warning',
  DRAFT: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'secondary',
}

export const CAMPAIGN_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const
export type CampaignDiscountType = (typeof CAMPAIGN_DISCOUNT_TYPES)[number]

/**
 * A product in a campaign carries its own discount — the association is not a bare product id.
 * The nested `product` summary is present on responses; writes send `productId` instead.
 */
export interface CampaignProduct {
  id: string
  campaignId: string
  productId: string
  discountType: CampaignDiscountType
  discountValue: string
  product?: { id: string; name: string; slug: string }
}

export interface CampaignProductInput {
  productId: string
  discountType: CampaignDiscountType
  discountValue: number
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  status: CampaignStatus
  placement: CampaignPlacement | null
  /** Null on either side means that end of the window is open. */
  startsAt: string | null
  endsAt: string | null
  products: CampaignProduct[]
  createdAt: string
  updatedAt: string
}

export interface CampaignInput {
  name: string
  description?: string
  status?: CampaignStatus
  placement?: CampaignPlacement
  startsAt?: string
  endsAt?: string
  products?: CampaignProductInput[]
}

export interface CampaignListParams extends ListParams {
  status?: CampaignStatus
}

async function listCampaigns(params: CampaignListParams = {}): Promise<PaginatedResponse<Campaign>> {
  const limit = params.limit ?? 20

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<Campaign[]>(`/campaigns?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getCampaign(id: string): Promise<Campaign> {
  const res = await request<Campaign>(`/campaigns/${id}`)
  return res.data
}

async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const res = await request<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
  const res = await request<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deleteCampaign(id: string): Promise<void> {
  await request<Campaign>(`/campaigns/${id}`, { method: 'DELETE' })
}

export function useCampaigns(params: CampaignListParams = {}) {
  return useQuery({ queryKey: queryKeys.campaigns.list(params), queryFn: () => listCampaigns(params) })
}

export function useCampaign(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.campaigns.detail(id ?? ''), queryFn: () => getCampaign(id!), enabled: !!id })
}

export function useCreateCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  })
}

export function useUpdateCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CampaignInput }) => updateCampaign(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  })
}

export function useDeleteCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  })
}
