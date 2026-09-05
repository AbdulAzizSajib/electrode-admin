import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Image as ImageIcon, Newspaper, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResourceListPage, type ResourceListParams } from '@/components/crud/resource-list-page'
import {
  useBlogPosts,
  useDeleteBlogPost,
  BLOG_POST_STATUSES,
  type BlogPost,
  type BlogPostStatus,
} from '@/lib/api/blog-posts'
import { formatDate } from '@/lib/utils/format'

export const BLOG_PATH = '/ui/blog'

/**
 * How many posts the storefront's homepage section shows.
 *
 * Only used for the hint below the list, which is why a local copy is acceptable here where the
 * testimonials list takes its number from the server: this one is advisory prose, not a per-row
 * marker, and the blog index shows every post regardless — an overflowing post is still reachable.
 */
const HOME_SECTION_COUNT = 4

export default function BlogListPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteBlogPost()
  const [statusFilter, setStatusFilter] = React.useState<'all' | BlogPostStatus>('all')

  /* Same wrapper pattern as the Pages list — the filter rides into the query so
     page 2 is not left half empty by client-side filtering. */
  const useFilteredPosts = (params: ResourceListParams) =>
    useBlogPosts({ ...params, status: statusFilter === 'all' ? undefined : statusFilter })

  const columns: ColumnDef<BlogPost>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.title}</span>,
    },
    {
      accessorKey: 'slug',
      header: 'Address',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          /blogs/{row.original.slug}
          {/* Only for a live post — a draft's URL 404s, so offering to open it
              would just look broken. */}
          {row.original.status === 'PUBLISHED' && (
            <ExternalLink className="size-3 opacity-50" aria-hidden />
          )}
        </span>
      ),
    },
    {
      id: 'media',
      header: 'Media',
      cell: ({ row }) => {
        const { mediaType } = row.original
        if (mediaType === 'IMAGE') {
          return (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ImageIcon className="size-3.5" aria-hidden /> Image
            </span>
          )
        }
        if (mediaType === 'VIDEO') {
          return (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Video className="size-3.5" aria-hidden /> Video
            </span>
          )
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'PUBLISHED' ? 'success' : 'secondary'}>
          {row.original.status === 'PUBLISHED' ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      accessorKey: 'publishedAt',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.publishedAt),
    },
  ]

  return (
    <ResourceListPage
      title="Blog"
      description={`Posts on the storefront. The newest ${HOME_SECTION_COUNT} appear in the homepage's "Our Latest Blog" section; every published post is listed on the blog page.`}
      noun="post"
      icon={Newspaper}
      emptyTitle="No posts yet"
      emptyDescription="Until a post is published, the homepage's blog section is hidden entirely rather than shown empty."
      searchPlaceholder="Search by title, address or excerpt…"
      columns={columns}
      useList={useFilteredPosts}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title}
      onCreate={() => navigate(`${BLOG_PATH}/new`)}
      createLabel="New post"
      onEdit={(row) => navigate(`${BLOG_PATH}/${row.id}`)}
      toolbar={
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | BlogPostStatus)}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BLOG_POST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'PUBLISHED' ? 'Published' : 'Draft'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      remove={{
        // Nothing references a post as a foreign key, so the server has nothing
        // to refuse over — but its address goes dead, which is what the prompt
        // warns about.
        mode: 'simple',
        remove: ({ id }) => deleteMutation.mutateAsync(id),
        confirmDescription:
          'Any link pointing at this post — including one shared elsewhere — will start leading to a Not Found page.',
      }}
    />
  )
}
