import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, delay, generateId, matchesSearch, paginate, type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { queryKeys } from '@/lib/api/query-keys'
import { recordAuditEntry } from '@/lib/api/audit-logs'

export interface Campaign {
  id: string
  name: string
  description: string
  couponIds: string[]
  productIds: string[]
  startDate: string
  endDate: string
  isActive: boolean
  metrics: { views: number; redemptions: number }
  createdAt: string
}

export interface CampaignInput {
  name: string
  description: string
  couponIds: string[]
  productIds: string[]
  startDate: string
  endDate: string
  isActive: boolean
}

let campaigns: Campaign[] = [
  { id: generateId('cmp'), name: 'Winter Clearance', description: 'Storewide discounts on winter apparel and gear.', couponIds: [], productIds: [], startDate: '2025-12-01', endDate: '2026-01-15', isActive: true, metrics: { views: 18420, redemptions: 612 }, createdAt: '2025-11-20T09:00:00Z' },
  { id: generateId('cmp'), name: 'New Year Electronics Sale', description: 'Featured deals on audio and mobile devices.', couponIds: [], productIds: [], startDate: '2025-12-28', endDate: '2026-01-10', isActive: true, metrics: { views: 9310, redemptions: 245 }, createdAt: '2025-12-15T09:00:00Z' },
  { id: generateId('cmp'), name: 'Back to Office', description: 'Laptops and productivity gear bundle promo.', couponIds: [], productIds: [], startDate: '2025-08-01', endDate: '2025-09-15', isActive: false, metrics: { views: 5210, redemptions: 130 }, createdAt: '2025-07-20T09:00:00Z' },
]

async function listCampaigns(params: ListParams = {}): Promise<PaginatedResponse<Campaign>> {
  const filtered = campaigns.filter((c) => matchesSearch([c.name], params.search))
  return delay(paginate(filtered, params))
}

async function getCampaign(id: string): Promise<Campaign> {
  const found = campaigns.find((c) => c.id === id)
  if (!found) throw new ApiError('Campaign not found', 404)
  return delay(found)
}

async function createCampaign(input: CampaignInput): Promise<Campaign> {
  if (input.endDate < input.startDate) throw new ApiError('End date must be after the start date.', 422)
  const campaign: Campaign = { id: generateId('cmp'), metrics: { views: 0, redemptions: 0 }, createdAt: new Date().toISOString(), ...input }
  campaigns = [campaign, ...campaigns]
  recordAuditEntry({ action: 'campaign.created', resourceType: 'campaign', resourceId: campaign.id, resourceLabel: campaign.name })
  return delay(campaign)
}

async function updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
  const index = campaigns.findIndex((c) => c.id === id)
  if (index === -1) throw new ApiError('Campaign not found', 404)
  if (input.endDate < input.startDate) throw new ApiError('End date must be after the start date.', 422)
  const updated = { ...campaigns[index], ...input }
  campaigns = campaigns.map((c) => (c.id === id ? updated : c))
  recordAuditEntry({ action: 'campaign.updated', resourceType: 'campaign', resourceId: id, resourceLabel: updated.name })
  return delay(updated)
}

async function deleteCampaign(id: string): Promise<void> {
  const target = campaigns.find((c) => c.id === id)
  campaigns = campaigns.filter((c) => c.id !== id)
  recordAuditEntry({ action: 'campaign.deleted', resourceType: 'campaign', resourceId: id, resourceLabel: target?.name })
  return delay(undefined)
}

export function useCampaigns(params: ListParams = {}) {
  return useQuery({ queryKey: queryKeys.campaigns.list(params), queryFn: () => listCampaigns(params) })
}

export function useCampaign(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.campaigns.detail(id ?? ''), queryFn: () => getCampaign(id!), enabled: !!id })
}

export function useCreateCampaign() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createCampaign, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.campaigns.all }) })
}

export function useUpdateCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CampaignInput }) => updateCampaign(id, input),
    onSuccess: (_d, v) => {
      client.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      client.invalidateQueries({ queryKey: queryKeys.campaigns.detail(v.id) })
    },
  })
}

export function useDeleteCampaign() {
  const client = useQueryClient()
  return useMutation({ mutationFn: deleteCampaign, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.campaigns.all }) })
}
