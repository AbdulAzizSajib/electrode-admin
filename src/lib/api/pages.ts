/** Real backend content-page calls — follows the same envelope/error pattern as `banners.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * Declared as a `const` array with the union derived from it, so the options the UI renders and the
 * types it checks against cannot drift — same reason `banners.ts` does it.
 */
export const PAGE_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type PageStatus = (typeof PAGE_STATUSES)[number]

export interface Page {
  id: string
  title: string
  slug: string
  /** Semantic HTML from the rich-text editor. Sanitised by the storefront on render, not here. */
  body: string
  metaTitle: string | null
  metaDescription: string | null
  status: PageStatus
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PageInput {
  title: string
  /** Omit to let the backend derive it from the title. */
  slug?: string
  body: string
  metaTitle?: string
  metaDescription?: string
  status?: PageStatus
  sortOrder?: number
}

export interface PageListParams extends ListParams {
  status?: PageStatus
}

/** What the public list endpoint returns — enough for a link picker, without every page's body. */
export interface PageSummary {
  id: string
  title: string
  slug: string
}

async function listPages(params: PageListParams = {}): Promise<PaginatedResponse<Page>> {
  const limit = params.limit ?? 50

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<Page[]>(`/pages/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getPage(id: string): Promise<Page> {
  const res = await request<Page>(`/pages/admin/${id}`)
  return res.data
}

async function createPage(input: PageInput): Promise<Page> {
  const res = await request<Page>('/pages', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updatePage(id: string, input: Partial<PageInput>): Promise<Page> {
  const res = await request<Page>(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  return res.data
}

async function deletePage(id: string): Promise<void> {
  await request<Page>(`/pages/${id}`, { method: 'DELETE' })
}

/**
 * Top-level storefront segments a slug may not use.
 *
 * Fetched rather than hardcoded here on purpose: admin and the storefront are separate
 * deployments, so a copy in this file would drift the first time someone adds a storefront route.
 * The server owns the list — see the backend's `page.constant.ts`.
 */
async function getReservedSlugs(): Promise<string[]> {
  const res = await request<string[]>('/pages/reserved-slugs')
  return res.data
}

/** Published pages only — the targets the nav and footer link pickers offer. */
async function listPublishedPages(): Promise<PageSummary[]> {
  const res = await request<PageSummary[]>('/pages')
  return res.data
}

export function usePages(params: PageListParams = {}) {
  return useQuery({ queryKey: queryKeys.pages.list(params), queryFn: () => listPages(params) })
}

export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pages.detail(id ?? ''),
    queryFn: () => getPage(id!),
    enabled: !!id,
  })
}

export function useReservedSlugs() {
  return useQuery({
    queryKey: queryKeys.pages.reservedSlugs,
    queryFn: getReservedSlugs,
    // The list only changes when a storefront route is added and the server is
    // redeployed, so refetching it per mount is pure waste.
    staleTime: Infinity,
  })
}

export function usePublishedPages() {
  return useQuery({ queryKey: queryKeys.pages.published, queryFn: listPublishedPages })
}

export function useCreatePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createPage,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pages.all }),
  })
}

export function useUpdatePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PageInput> }) => updatePage(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pages.all }),
  })
}

export function useDeletePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deletePage,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pages.all }),
  })
}
