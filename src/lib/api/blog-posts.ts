/** Real backend blog-post calls — follows the same envelope/error pattern as `pages.ts`. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * Declared as `const` arrays with the unions derived from them, so the options the UI renders and
 * the types it checks against cannot drift — same reason `pages.ts` does it.
 */
export const BLOG_POST_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number]

/**
 * Which of the three media columns is meaningful.
 *
 * Stated rather than inferred from which URL happens to be set: with three nullable columns, "image
 * or video, never both" is a rule the data merely implies, and a post holding both has no defined
 * answer. The backend's Zod schema enforces the correspondence, and this form is built so it cannot
 * compose a payload that breaks it.
 */
export const BLOG_MEDIA_TYPES = ['NONE', 'IMAGE', 'VIDEO'] as const
export type BlogMediaType = (typeof BLOG_MEDIA_TYPES)[number]

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  /** Semantic HTML from the rich-text editor. Sanitised by the storefront on render, not here. */
  body: string
  mediaType: BlogMediaType
  imageUrl: string | null
  videoUrl: string | null
  /** Never null on a VIDEO post — the upload endpoint derives a frame when none is supplied. */
  videoThumbnailUrl: string | null
  /** The date on the card and the sort key, not a publication timestamp. */
  publishedAt: string
  metaTitle: string | null
  metaDescription: string | null
  status: BlogPostStatus
  createdAt: string
  updatedAt: string
}

export interface BlogPostInput {
  title: string
  /** Omit to let the backend derive it from the title. */
  slug?: string
  excerpt: string
  body: string
  /**
   * The four media fields move as a SET. The backend re-checks the invariant whenever a payload
   * mentions any of them, and rejects one that names a URL without its type — so a form that edits
   * media must send `mediaType` alongside.
   */
  mediaType?: BlogMediaType
  imageUrl?: string
  videoUrl?: string
  videoThumbnailUrl?: string
  publishedAt?: string
  metaTitle?: string
  metaDescription?: string
  status?: BlogPostStatus
}

export interface BlogPostListParams extends ListParams {
  status?: BlogPostStatus
}

async function listBlogPosts(params: BlogPostListParams = {}): Promise<PaginatedResponse<BlogPost>> {
  const limit = params.limit ?? 50

  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  query.set('limit', String(limit))
  if (params.search) query.set('searchTerm', params.search)
  if (params.status) query.set('status', params.status)

  const res = await request<BlogPost[]>(`/blog-posts/admin?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

async function getBlogPost(id: string): Promise<BlogPost> {
  const res = await request<BlogPost>(`/blog-posts/admin/${id}`)
  return res.data
}

async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const res = await request<BlogPost>('/blog-posts', { method: 'POST', body: JSON.stringify(input) })
  return res.data
}

async function updateBlogPost(id: string, input: Partial<BlogPostInput>): Promise<BlogPost> {
  const res = await request<BlogPost>(`/blog-posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

async function deleteBlogPost(id: string): Promise<void> {
  await request<BlogPost>(`/blog-posts/${id}`, { method: 'DELETE' })
}

export function useBlogPosts(params: BlogPostListParams = {}) {
  return useQuery({
    queryKey: queryKeys.blogPosts.list(params),
    queryFn: () => listBlogPosts(params),
  })
}

export function useBlogPost(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.blogPosts.detail(id ?? ''),
    queryFn: () => getBlogPost(id!),
    enabled: !!id,
  })
}

export function useCreateBlogPost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.blogPosts.all }),
  })
}

export function useUpdateBlogPost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<BlogPostInput> }) =>
      updateBlogPost(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.blogPosts.all }),
  })
}

export function useDeleteBlogPost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.blogPosts.all }),
  })
}
