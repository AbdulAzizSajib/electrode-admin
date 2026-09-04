import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResourceListPage, type ResourceListParams } from '@/components/crud/resource-list-page'
import { usePages, useDeletePage, PAGE_STATUSES, type Page, type PageStatus } from '@/lib/api/pages'
import { formatDate } from '@/lib/utils/format'

export const PAGES_PATH = '/ui/pages'

export default function PagesListPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeletePage()
  const [statusFilter, setStatusFilter] = React.useState<'all' | PageStatus>('all')

  /*
   * Wraps the resource hook so the shared list page — which only knows about
   * search and paging — can still drive this page's own status filter. The
   * filter rides into the query rather than being applied to the response,
   * because filtering an already-paginated page client-side would leave page 2
   * half empty.
   *
   * Declared as a `use`-prefixed function, not a `useCallback`: the shared page
   * calls it as a hook, so it has to be recognisable as one. Its identity
   * changing per render is fine — it is invoked unconditionally, so hook order
   * is stable.
   */
  const useFilteredPages = (params: ResourceListParams) =>
    usePages({ ...params, status: statusFilter === 'all' ? undefined : statusFilter })

  const columns: ColumnDef<Page>[] = [
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
          /{row.original.slug}
          {/* Only for a live page — a draft's URL 404s, so offering to open it
              would just look broken. */}
          {row.original.status === 'PUBLISHED' && (
            <ExternalLink className="size-3 opacity-50" aria-hidden />
          )}
        </span>
      ),
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
      accessorKey: 'updatedAt',
      header: 'Last edited',
      cell: ({ row }) => formatDate(row.original.updatedAt),
    },
  ]

  return (
    <ResourceListPage
      title="Pages"
      description="Content pages on the storefront — About, Terms & Conditions, Refund Policy and the like."
      noun="page"
      icon={FileText}
      emptyTitle="No pages yet"
      emptyDescription="Write a page once here and link to it from the header or footer."
      searchPlaceholder="Search by title or address…"
      columns={columns}
      useList={useFilteredPages}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title}
      onCreate={() => navigate(`${PAGES_PATH}/new`)}
      createLabel="New page"
      onEdit={(row) => navigate(`${PAGES_PATH}/${row.id}`)}
      toolbar={
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | PageStatus)}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'PUBLISHED' ? 'Published' : 'Draft'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      remove={{
        // Nothing references a page as a foreign key. A footer link pointing at
        // it is just stored text, so the server has nothing to refuse over —
        // but the link would go dead, which is what the prompt warns about.
        mode: 'simple',
        remove: ({ id }) => deleteMutation.mutateAsync(id),
        confirmDescription:
          'Any header or footer link pointing at this page will start leading to a Not Found page.',
      }}
    />
  )
}
