import * as React from 'react'
import { useNavigate } from 'react-router'
import { GalleryHorizontal, ImageOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { PLACEMENT_LABEL } from '@/features/ui/banners/banner-labels'
import { isHeroPlacement } from '@/features/ui/home-slider/hero-slots'
import {
  useBanners,
  useDeleteBanner,
  BANNER_PLACEMENTS,
  BANNER_STATUSES,
  type BannerPlacement,
  type BannerStatus,
} from '@/lib/api/banners'

export const BANNERS_PATH = '/ui/banners'

/**
 * The hero placements are owned by the Home Slider manager and deliberately do
 * not appear here — see `hero-slots.ts`. Listing them in both places would let
 * the same record be edited from two surfaces with different capacity rules.
 */
const NON_HERO_PLACEMENTS = BANNER_PLACEMENTS.filter((p) => !isHeroPlacement(p))

const STATUS_VARIANT: Record<BannerStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  DRAFT: 'secondary',
  INACTIVE: 'secondary',
  SCHEDULED: 'warning',
}

export default function BannersPage() {
  const navigate = useNavigate()
  const [placementFilter, setPlacementFilter] = React.useState<'all' | BannerPlacement>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | BannerStatus>('all')

  const { data, isLoading, error } = useBanners({
    placement: placementFilter === 'all' ? undefined : placementFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const deleteMutation = useDeleteBanner()
  const confirmDialog = useConfirmDialog()

  /*
   * Filtered here as well as in the placement dropdown: with no placement
   * selected the endpoint returns every region, hero ones included. Without
   * this the "All placements" view would list exactly the banners this page is
   * not supposed to own.
   */
  const banners = (data?.data ?? []).filter((banner) => !isHeroPlacement(banner.placement))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Banners"
        description="Promotional banners outside the homepage hero — header, mid-page, footer, sidebar and popup."
        actions={
          <div className="flex items-center gap-2">
            <Button size="lg" variant="outline" onClick={() => navigate('/ui/home-slider')}>
              <GalleryHorizontal /> Home slider
            </Button>
            <Button size="lg" onClick={() => navigate(`${BANNERS_PATH}/new`)}>
              <Plus /> New banner
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={placementFilter} onValueChange={(v) => setPlacementFilter(v as 'all' | BannerPlacement)}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Placement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All placements</SelectItem>
            {NON_HERO_PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | BannerStatus)}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BANNER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load banners.'}</p>
      ) : banners.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="No banners yet"
          description="Add a banner to promote something on the storefront. The homepage hero is managed separately, under Home Slider."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {banners.map((banner) => (
            <Card key={banner.id} className="flex items-center gap-3 p-2.5">
              {banner.image ? (
                <img src={banner.image} alt="" className="h-14 w-24 shrink-0 rounded-md border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                  <ImageOff className="size-4" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">{banner.title ?? <span className="text-muted-foreground">Untitled</span>}</span>
                <span className="text-xs text-muted-foreground">
                  {PLACEMENT_LABEL[banner.placement]} · {banner.type} · order {banner.sortOrder}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[banner.status]}>{banner.status}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`${BANNERS_PATH}/${banner.id}`)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      confirmDialog.confirm(async () => {
                        try {
                          await deleteMutation.mutateAsync(banner.id)
                          toast({ title: 'Banner deleted' })
                        } catch (err) {
                          toast({ title: 'Could not delete banner', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                        }
                      })
                    }
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this banner?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
