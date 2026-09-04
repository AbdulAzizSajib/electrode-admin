import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Megaphone, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useCampaigns,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_VARIANT,
  type Campaign,
  type CampaignStatus,
} from '@/lib/api/campaigns'
import { formatDate } from '@/lib/utils/format'

export const CAMPAIGNS_PATH = '/marketing/campaigns'

/**
 * A Select cannot hold an empty string as a value, so "no placement" needs a
 * sentinel. Shared with the form page, which strips it before sending.
 */
export const NO_PLACEMENT = 'none'

export default function CampaignsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | CampaignStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCampaigns({
    search,
    page,
    limit: pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const columns: ColumnDef<Campaign>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    {
      id: 'window',
      header: 'Window',
      cell: ({ row }) => {
        const { startsAt, endsAt } = row.original
        if (!startsAt && !endsAt) return <span className="text-muted-foreground">Always</span>
        return `${startsAt ? formatDate(startsAt) : '—'} – ${endsAt ? formatDate(endsAt) : '—'}`
      },
    },
    {
      id: 'placement',
      header: 'Placement',
      cell: ({ row }) => row.original.placement ?? <span className="text-muted-foreground">—</span>,
    },
    { id: 'products', header: 'Products', cell: ({ row }) => row.original.products.length },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={CAMPAIGN_STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Campaigns"
        description="Time-boxed promotions that discount a set of products."
        actions={
          <Button size="sm" onClick={() => navigate(`${CAMPAIGNS_PATH}/new`)}>
            <Plus /> New campaign
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search campaigns…"
        onRowClick={(row) => navigate(`${CAMPAIGNS_PATH}/${row.id}`)}
        emptyState={{ icon: Megaphone, title: 'No campaigns yet' }}
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | CampaignStatus); setPage(1) }}>
            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CAMPAIGN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />
    </div>
  )
}
