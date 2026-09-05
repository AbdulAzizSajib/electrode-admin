import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, ExternalLink, Radio, Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { ResourceListPage, type ResourceListParams } from '@/components/crud/resource-list-page'
import {
  useLandingPages,
  useDeleteLandingPage,
  useDuplicateLandingPage,
  LANDING_PAGE_STATUSES,
  type LandingPage,
  type LandingPageStatus,
} from '@/lib/api/landing-pages'
import { useStoreSettings } from '@/lib/api/store-settings'
import { formatCurrency } from '@/lib/utils/format'
import { SiteModeBanner } from './site-mode-banner'

export const LANDING_PAGES_PATH = '/ui/landing-pages'

export default function LandingPagesListPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteLandingPage()
  const duplicateMutation = useDuplicateLandingPage()
  const settings = useStoreSettings()
  const [statusFilter, setStatusFilter] = React.useState<'all' | LandingPageStatus>('all')

  /**
   * Which page is currently serving the storefront root.
   *
   * BOTH halves, not just the selection: a page that is selected while the shop
   * is in website mode is not live, and marking it "Live" would tell a merchant
   * their campaign is running when their homepage is showing the normal shop.
   */
  const livePageId =
    settings.data?.siteMode === 'LANDING_PAGE' ? settings.data.activeLandingPageId : null

  const useFilteredLandingPages = (params: ResourceListParams) =>
    useLandingPages({
      ...params,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })

  const columns: ColumnDef<LandingPage>[] = [
    {
      id: 'title',
      header: 'Campaign',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="flex items-center gap-2 font-medium text-foreground">
            {row.original.title}
            {row.original.id === livePageId && (
              <Badge variant="success" className="gap-1">
                <Radio className="size-3" aria-hidden />
                Live
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">/lp/{row.original.slug}</span>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.product?.name ?? '—'}</span>
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
      id: 'orders',
      header: 'Orders',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.orderCount ?? 0}</span>
      ),
    },
    {
      id: 'revenue',
      header: 'Revenue',
      cell: ({ row }) => (
        <span className="tabular-nums font-medium text-foreground">
          {formatCurrency(row.original.revenue ?? 0)}
        </span>
      ),
    },
  ]

  return (
    <>
      <SiteModeBanner />
      <ResourceListPage
        title="Landing Pages"
        description="One product, one page, one order form — for the traffic you send from an ad."
        noun="landing page"
        icon={Rocket}
        emptyTitle="No landing pages yet"
        emptyDescription="Create one to sell a single product from a focused page, without the rest of your site around it."
        searchPlaceholder="Search by campaign name, address or headline…"
        columns={columns}
        useList={useFilteredLandingPages}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        onCreate={() => navigate(`${LANDING_PAGES_PATH}/new`)}
        createLabel="New landing page"
        onEdit={(row) => navigate(`${LANDING_PAGES_PATH}/${row.id}`)}
        rowActions={(row) => (
          <>
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  const copy = await duplicateMutation.mutateAsync(row.id)
                  toast({ title: `Duplicated as "${copy.title}"` })
                  navigate(`${LANDING_PAGES_PATH}/${copy.id}`)
                } catch (error) {
                  toast({
                    variant: 'destructive',
                    title: 'Could not duplicate',
                    description: error instanceof Error ? error.message : 'Please try again.',
                  })
                }
              }}
            >
              <Copy className="size-4" aria-hidden />
              Duplicate
            </DropdownMenuItem>
            {/*
              Published pages only. A draft 404s on the storefront, so this link
              would take a merchant to a not-found page and leave them thinking
              the feature is broken — the preview link on the form is what
              covers a draft.
            */}
            {row.status === 'PUBLISHED' && (
              <DropdownMenuItem asChild>
                <a href={`/lp/${row.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  View page
                </a>
              </DropdownMenuItem>
            )}
          </>
        )}
        toolbar={
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | LandingPageStatus)}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LANDING_PAGE_STATUSES.map((s) => (
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
          /*
           * The orders survive. Said out loud because "delete the campaign" and
           * "delete the sales it made" are very different actions, and a
           * merchant tidying up finished campaigns needs to know which one this
           * is. Deleting the LIVE page is refused by the server, and its own
           * message — which names the fix — is what the dialog shows.
           */
          confirmDescription:
            'The orders this campaign produced are kept and still name it. The page itself stops being reachable.',
        }}
      />
    </>
  )
}
