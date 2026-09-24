/**
 * Promo banner groups — the merchant's promotional strips.
 *
 * A group is one strip on the homepage: a name, how many tiles it shows across,
 * and its order among the other strips. Its BANNERS are not edited from here —
 * a banner names its group, so membership is set on the banner form. That keeps
 * one writer per relation rather than two that could disagree.
 *
 * Follows the same envelope/error pattern as `testimonials.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * MIRRORS `PROMO_BANNER_LAYOUTS` in the backend's store-setting.constant.ts and
 * the `PromoBannerLayout` enum in its schema. Keep all three in step.
 *
 * ORDER IS LOAD-BEARING: position 0 is the default, and `THREE` holds it
 * because three-across is what the storefront rendered before strips were
 * groupable. It is also the order this list is offered in, so reordering it
 * reorders the merchant's choices.
 */
export const PROMO_BANNER_LAYOUTS = ['THREE', 'TWO', 'ONE'] as const
export type PromoBannerLayout = (typeof PROMO_BANNER_LAYOUTS)[number]

/** How many tiles each layout renders — used to warn when a strip is under- or over-filled. */
export const PROMO_LAYOUT_TILE_COUNT: Record<PromoBannerLayout, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
}

/**
 * What a merchant reads, and the artwork size that layout expects.
 *
 * The dimensions are the storefront's own aspect ratios at a typical content
 * width — `aspect-6/1`, `aspect-3/1`, `aspect-2/1` in
 * `nextjs/src/components/home/promo/layouts.ts`. THEY MUST BE KEPT IN STEP WITH
 * THAT FILE: quoting the wrong shape means a merchant exports artwork the
 * storefront then crops, and nothing tells them the advice was wrong. The same
 * obligation `hero-slots.ts` carries for the hero.
 */
export const PROMO_LAYOUT_LABEL: Record<
  PromoBannerLayout,
  { label: string; description: string; recommended: string }
> = {
  THREE: {
    label: 'Three across',
    description: 'Three tiles side by side. The original promo strip.',
    recommended: '840 × 420',
  },
  TWO: {
    label: 'Two across',
    description: 'Two half-width tiles.',
    recommended: '1280 × 427',
  },
  ONE: {
    label: 'Full width',
    description: 'One wide banner across the whole row.',
    recommended: '2560 × 427',
  },
}

/** Mirrors the backend's MAX_PROMO_GROUP_NAME_LENGTH. */
export const PROMO_GROUP_NAME_MAX_LENGTH = 60

export interface PromoBannerGroup {
  id: string
  name: string
  layout: PromoBannerLayout
  sortOrder: number
  /** Served with the row so the list can warn on a mismatch without loading the banners. */
  bannerCount: number
  createdAt: string
  updatedAt: string
}

export interface PromoBannerGroupInput {
  name: string
  layout?: PromoBannerLayout
  sortOrder?: number
}

async function listPromoBannerGroups(): Promise<PromoBannerGroup[]> {
  const res = await request<PromoBannerGroup[]>('/promo-banner-groups')
  return res.data
}

async function createPromoBannerGroup(
  input: PromoBannerGroupInput,
): Promise<PromoBannerGroup> {
  const res = await request<PromoBannerGroup>('/promo-banner-groups', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updatePromoBannerGroup(
  id: string,
  input: Partial<PromoBannerGroupInput>,
): Promise<PromoBannerGroup> {
  const res = await request<PromoBannerGroup>(`/promo-banner-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/** Sends the intended order; the server assigns the numbering. */
async function reorderPromoBannerGroups(ids: string[]): Promise<PromoBannerGroup[]> {
  const res = await request<PromoBannerGroup[]>('/promo-banner-groups/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  })
  return res.data
}

async function deletePromoBannerGroup(id: string): Promise<void> {
  await request<PromoBannerGroup>(`/promo-banner-groups/${id}`, { method: 'DELETE' })
}

export function usePromoBannerGroups() {
  return useQuery({
    queryKey: queryKeys.promoBannerGroups.list(),
    queryFn: listPromoBannerGroups,
  })
}

/*
 * Every mutation invalidates the HOME SECTIONS view as well as the group list.
 *
 * Creating a group adds a row to the merchant's homepage configuration (the
 * server splices one in on read), and deleting one removes it. A merchant who
 * created a strip and saw the Home Sections list unchanged would reasonably
 * conclude the strip was not created.
 */
function useInvalidateGroups() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.promoBannerGroups.all })
    void client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail })
  }
}

export function useCreatePromoBannerGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({ mutationFn: createPromoBannerGroup, onSuccess: invalidate })
}

export function useUpdatePromoBannerGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PromoBannerGroupInput> }) =>
      updatePromoBannerGroup(id, input),
    onSuccess: invalidate,
  })
}

export function useReorderPromoBannerGroups() {
  const invalidate = useInvalidateGroups()
  return useMutation({ mutationFn: reorderPromoBannerGroups, onSuccess: invalidate })
}

/*
 * Deleting a group also invalidates BANNERS: the group's tiles are detached
 * rather than deleted, so every one of them becomes an unassigned banner the
 * banner list must now show as such.
 */
export function useDeletePromoBannerGroup() {
  const client = useQueryClient()
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: deletePromoBannerGroup,
    onSuccess: () => {
      invalidate()
      void client.invalidateQueries({ queryKey: queryKeys.banners.all })
    },
  })
}
