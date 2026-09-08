import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from './request'
import { queryKeys } from './query-keys'
import type { PaginatedResponse } from './client'
import type { SeoContentType } from './store-settings'

/**
 * The cross-content SEO overview — every SEO-bearing record from all five
 * content types, as one list.
 *
 * READ-ONLY here. Edits dispatch to each resource's own PATCH endpoint (see
 * `useUpdateRowSeo` at the bottom), so there is exactly one writer per field and
 * the SEO screen and the record's own edit form cannot drift apart.
 */

export interface SeoOverviewRow {
  id: string
  contentType: SeoContentType
  /** The record's own display title — what the storefront falls back to. */
  title: string
  /** Storefront path, for the "view live page" link. */
  path: string
  /** The record's SEO override, or null when it has none. */
  metaTitle: string | null
  metaDescription: string | null
  /** False for drafts and archived records, which no metadata reaches. */
  isPublished: boolean
  updatedAt: string
}

export interface SeoOverviewParams {
  contentType?: SeoContentType
  search?: string
  page?: number
  limit?: number
}

async function getSeoOverview(
  params: SeoOverviewParams,
): Promise<PaginatedResponse<SeoOverviewRow>> {
  const query = new URLSearchParams()
  if (params.contentType) query.set('contentType', params.contentType)
  // Only when non-empty: a blank `search=` is a filter matching nothing, the
  // same reason `buildListQuery` omits an empty `searchTerm`.
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))

  const qs = query.toString()
  const res = await request<SeoOverviewRow[]>(`/seo/overview${qs ? `?${qs}` : ''}`)
  return res as PaginatedResponse<SeoOverviewRow>
}

export function useSeoOverview(params: SeoOverviewParams) {
  return useQuery({
    queryKey: queryKeys.seo.overview(params),
    queryFn: () => getSeoOverview(params),
  })
}

/**
 * Where each content type's SEO fields are written, and what they are called
 * there.
 *
 * The two naming conventions are the reason this map exists: Product and
 * Category store `seoTitle`/`seoDescription`, while Page, BlogPost and
 * LandingPage store `metaTitle`/`metaDescription`. The overview normalises both
 * onto `metaTitle` for display, so writing back has to un-normalise.
 *
 * Renaming five sets of columns to avoid this map was considered and rejected —
 * a breaking change across five models, five validators and five admin forms to
 * tidy one screen. See the change's design.md Non-Goals.
 */
const WRITE_TARGET: Record<
  SeoContentType,
  { path: string; titleKey: 'seoTitle' | 'metaTitle'; descriptionKey: 'seoDescription' | 'metaDescription' }
> = {
  product: { path: 'products', titleKey: 'seoTitle', descriptionKey: 'seoDescription' },
  category: { path: 'categories', titleKey: 'seoTitle', descriptionKey: 'seoDescription' },
  page: { path: 'pages', titleKey: 'metaTitle', descriptionKey: 'metaDescription' },
  blogPost: { path: 'blog-posts', titleKey: 'metaTitle', descriptionKey: 'metaDescription' },
  landingPage: { path: 'landing-pages', titleKey: 'metaTitle', descriptionKey: 'metaDescription' },
}

export interface UpdateRowSeoInput {
  id: string
  contentType: SeoContentType
  metaTitle: string
  metaDescription: string
}

/**
 * Saves one row's SEO fields through the owning resource's own endpoint.
 *
 * Empty strings are sent as-is rather than omitted: the backend's partial upsert
 * reads an omitted key as "leave unchanged", so omitting would make clearing a
 * meta title impossible from this screen.
 */
async function updateRowSeo({ id, contentType, metaTitle, metaDescription }: UpdateRowSeoInput) {
  const target = WRITE_TARGET[contentType]

  await request(`/${target.path}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      [target.titleKey]: metaTitle,
      [target.descriptionKey]: metaDescription,
    }),
  })
}

export function useUpdateRowSeo() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: updateRowSeo,
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: queryKeys.seo.all })
      /*
       * The record's own list too, so a product edited here shows its new meta
       * title on the products screen without a reload. Keyed off the write
       * target rather than a switch, so a new content type needs one map entry
       * and nothing else.
       */
      client.invalidateQueries({ queryKey: [WRITE_TARGET[variables.contentType].path] })
    },
  })
}
