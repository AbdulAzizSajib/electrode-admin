import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { EyeOff, MessageSquareQuote, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResourceListPage, type ResourceListParams } from '@/components/crud/resource-list-page'
import {
  useTestimonials,
  useDeleteTestimonial,
  TESTIMONIAL_STATUSES,
  type Testimonial,
  type TestimonialStatus,
} from '@/lib/api/testimonials'
import { initials } from '@/lib/utils/format'

export const TESTIMONIALS_PATH = '/ui/testimonials'

export default function TestimonialsListPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteTestimonial()
  const [statusFilter, setStatusFilter] = React.useState<'all' | TestimonialStatus>('all')

  /**
   * How many the homepage section renders, and the running count of published entries seen so far.
   *
   * Both come from the response rather than from a constant in this file: the section's capacity is
   * the server's number (`homeSectionCount`), and a label promising "only the first four appear" has
   * to be reading the four from whoever enforces it. Held in a ref-like object rather than state
   * because it is derived per render from data the table already has.
   */
  const overflow = React.useRef<{ capacity: number; publishedRank: Map<string, number> }>({
    capacity: 0,
    publishedRank: new Map(),
  })

  const useFilteredTestimonials = (params: ResourceListParams) => {
    const query = useTestimonials({
      ...params,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })

    /*
     * Rank is computed over the PUBLISHED entries only, in the order they are listed — which is the
     * order the storefront renders them. A draft occupies no slot in the section, so counting it
     * would make the marker lie.
     */
    const rank = new Map<string, number>()
    let seen = 0
    for (const row of query.data?.data ?? []) {
      if (row.status !== 'PUBLISHED') continue
      rank.set(row.id, seen)
      seen += 1
    }
    overflow.current = {
      capacity: query.data?.meta?.homeSectionCount ?? 0,
      publishedRank: rank,
    }

    return query
  }

  const columns: ColumnDef<Testimonial>[] = [
    {
      id: 'author',
      header: 'Author',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          {row.original.photoUrl ? (
            <img
              src={row.original.photoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            // The same fallback the storefront uses, so the list previews what
            // the site will actually render rather than an empty circle.
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {initials(row.original.authorName)}
            </span>
          )}
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.authorName}</span>
            <span className="text-xs text-muted-foreground">{row.original.authorRole}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'quote',
      header: 'Quote',
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-md text-muted-foreground">{row.original.quote}</span>
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
          <Star className="size-3.5 fill-current text-amber-500" aria-hidden />
          {row.original.rating}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { capacity, publishedRank } = overflow.current
        const rank = publishedRank.get(row.original.id)
        // Beyond what the homepage section renders. Said out loud because
        // otherwise a merchant publishes a fifth quote, never sees it, and has
        // no way to find out why.
        const beyondSection =
          row.original.status === 'PUBLISHED' && capacity > 0 && rank !== undefined && rank >= capacity

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={row.original.status === 'PUBLISHED' ? 'success' : 'secondary'}>
              {row.original.status === 'PUBLISHED' ? 'Published' : 'Draft'}
            </Badge>
            {beyondSection && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <EyeOff className="size-3" aria-hidden />
                Not on the homepage — it shows the first {capacity}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'sortOrder',
      header: 'Order',
      cell: ({ row }) => <span className="tabular-nums">{row.original.sortOrder}</span>,
    },
  ]

  return (
    <ResourceListPage
      title="Testimonials"
      description='Customer quotes for the homepage&apos;s "What Our Clients Say" section, in the order they appear.'
      noun="testimonial"
      icon={MessageSquareQuote}
      emptyTitle="No testimonials yet"
      emptyDescription="Until one is published, the homepage section is hidden entirely rather than shown empty."
      searchPlaceholder="Search by quote, name or role…"
      columns={columns}
      useList={useFilteredTestimonials}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.authorName}
      onCreate={() => navigate(`${TESTIMONIALS_PATH}/new`)}
      createLabel="New testimonial"
      onEdit={(row) => navigate(`${TESTIMONIALS_PATH}/${row.id}`)}
      toolbar={
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | TestimonialStatus)}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TESTIMONIAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'PUBLISHED' ? 'Published' : 'Draft'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      remove={{
        mode: 'simple',
        remove: ({ id }) => deleteMutation.mutateAsync(id),
        confirmDescription: 'This quote will be removed from the homepage.',
      }}
    />
  )
}
