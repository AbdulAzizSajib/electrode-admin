import * as React from 'react'
import {
  CalendarClock,
  GripVertical,
  ImageOff,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SlotEditorDialog } from '@/features/ui/home-slider/slot-editor-dialog'
import { moveItem } from '@/features/ui/components/settings-editor-utils'
import {
  HERO_SLOTS,
  formatRatio,
  formatSize,
  getHeroSlot,
  type HeroSlot,
} from '@/features/ui/home-slider/hero-slots'
import {
  useBanners,
  useDeleteBanner,
  useUpdateBanner,
  type Banner,
  type BannerPlacement,
} from '@/lib/api/banners'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

/**
 * The homepage hero, arranged the way the storefront arranges it.
 *
 * The point of this page over the flat banner list is that a merchant can see
 * WHICH box they are editing. Every slot is rendered at its true aspect ratio
 * (from `HERO_SLOTS`, measured off the storefront's own `Hero.tsx`), so an
 * empty promo tile looks like the wide strip it will become rather than like
 * another row in a table.
 */
export default function HomeSliderPage() {
  // One request for all three placements: `GET /banners/admin` returns every
  // region, and three filtered calls would be three round trips for the same
  // rows.
  const { data, isLoading, error } = useBanners({ limit: 100 })
  const updateMutation = useUpdateBanner()
  const deleteMutation = useDeleteBanner()
  const confirmDialog = useConfirmDialog()

  const [editing, setEditing] = React.useState<{ slot: HeroSlot; banner: Banner | null } | null>(null)

  const bySlot = React.useMemo(() => {
    const all = data?.data ?? []
    const grouped = new Map<BannerPlacement, Banner[]>()
    for (const slot of HERO_SLOTS) {
      grouped.set(
        slot.placement,
        all
          .filter((b) => b.placement === slot.placement)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    }
    return grouped
  }, [data])

  /*
   * Capacity is a UI rule, not a database one (design.md, "Hero slots stay
   * `Banner` rows"), so rows created before this page existed — or through the
   * API directly — can exceed it. The storefront truncates them, which means
   * they are invisible rather than broken. Surfacing them here is the whole
   * point: a merchant must never be left hunting for a banner they made.
   */
  const overflow = React.useMemo(() => {
    const extra: Banner[] = []
    for (const slot of HERO_SLOTS) {
      if (slot.capacity === null) continue
      extra.push(...(bySlot.get(slot.placement) ?? []).slice(slot.capacity))
    }
    return extra
  }, [bySlot])

  const overflowIds = React.useMemo(() => new Set(overflow.map((b) => b.id)), [overflow])
  const visible = (placement: BannerPlacement) =>
    (bySlot.get(placement) ?? []).filter((b) => !overflowIds.has(b.id))

  /** Rewrites `sortOrder` across a slot so the stored order matches what was dragged. */
  const persistOrder = async (ordered: Banner[]) => {
    try {
      await Promise.all(
        ordered.map((banner, index) =>
          banner.sortOrder === index
            ? null
            : updateMutation.mutateAsync({
                id: banner.id,
                input: { type: banner.type, placement: banner.placement, sortOrder: index },
              }),
        ),
      )
      toast({ title: 'Order updated' })
    } catch (err) {
      toast({
        title: 'Could not save the new order',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const removeBanner = (banner: Banner) =>
    confirmDialog.confirm(async () => {
      try {
        await deleteMutation.mutateAsync(banner.id)
        toast({ title: 'Removed from the hero' })
      } catch (err) {
        toast({
          title: 'Could not remove this slot',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    })

  /** Moves an overflow banner into a slot that still has room. */
  const reslot = async (banner: Banner, placement: BannerPlacement) => {
    try {
      await updateMutation.mutateAsync({
        id: banner.id,
        input: {
          type: banner.type,
          placement,
          sortOrder: (bySlot.get(placement) ?? []).length,
        },
      })
      toast({ title: 'Moved into the hero' })
    } catch (err) {
      toast({
        title: 'Could not move this banner',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const sliderSlot = HERO_SLOTS[0]
  const sideSlot = HERO_SLOTS[1]
  const promoSlot = HERO_SLOTS[2]

  const slides = visible('HERO_SLIDER')
  const sideTiles = visible('HERO_SIDE')
  const [promoTile] = visible('HERO_PROMO')

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Home slider" description="The homepage hero, as the storefront lays it out." />
        <Skeleton className="h-136 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Home slider" description="The homepage hero, as the storefront lays it out." />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the hero.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Home slider"
        description="The homepage hero, laid out as the storefront renders it. Each slot shows the artwork size it needs."
      />

      {/*
        Mirrors `Hero.tsx`: a flexible slider on the left and a fixed-width
        right column holding two side tiles above a wide promo. The ratios come
        from HERO_SLOTS, so this preview and the storefront cannot disagree
        about the shape of a slot.
      */}
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          <SlotSection
            slot={sliderSlot}
            count={slides.length}
            onAdd={() => setEditing({ slot: sliderSlot, banner: null })}
          >
            {slides.length === 0 ? (
              <EmptySlot
                slot={sliderSlot}
                onAdd={() => setEditing({ slot: sliderSlot, banner: null })}
              />
            ) : (
              <ReorderableRow
                items={slides}
                onReorder={persistOrder}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                renderItem={(banner, dragHandleProps) => (
                  <SlotTile
                    banner={banner}
                    slot={sliderSlot}
                    dragHandleProps={dragHandleProps}
                    onEdit={() => setEditing({ slot: sliderSlot, banner })}
                    onRemove={() => removeBanner(banner)}
                  />
                )}
              />
            )}
          </SlotSection>
        </div>

        <div className="flex w-full flex-col gap-4 xl:w-96 xl:flex-none">
          <SlotSection
            slot={sideSlot}
            count={sideTiles.length}
            onAdd={
              sideTiles.length < (sideSlot.capacity ?? Infinity)
                ? () => setEditing({ slot: sideSlot, banner: null })
                : undefined
            }
            atCapacityNote="The layout has exactly two side positions. Remove one to add another."
          >
            <ReorderableRow
              items={sideTiles}
              onReorder={persistOrder}
              className="grid grid-cols-2 gap-3"
              renderItem={(banner, dragHandleProps) => (
                <SlotTile
                  banner={banner}
                  slot={sideSlot}
                  dragHandleProps={dragHandleProps}
                  onEdit={() => setEditing({ slot: sideSlot, banner })}
                  onRemove={() => removeBanner(banner)}
                />
              )}
              trailing={
                sideTiles.length < 2 ? (
                  <EmptySlot slot={sideSlot} onAdd={() => setEditing({ slot: sideSlot, banner: null })} />
                ) : null
              }
            />
          </SlotSection>

          <SlotSection
            slot={promoSlot}
            count={promoTile ? 1 : 0}
            onAdd={promoTile ? undefined : () => setEditing({ slot: promoSlot, banner: null })}
            atCapacityNote="The layout has one promo position. Edit or remove it to change what is shown."
          >
            {promoTile ? (
              <SlotTile
                banner={promoTile}
                slot={promoSlot}
                onEdit={() => setEditing({ slot: promoSlot, banner: promoTile })}
                onRemove={() => removeBanner(promoTile)}
              />
            ) : (
              <EmptySlot slot={promoSlot} onAdd={() => setEditing({ slot: promoSlot, banner: null })} />
            )}
          </SlotSection>
        </div>
      </div>

      {overflow.length > 0 && (
        <OverflowStrip banners={overflow} onReslot={reslot} onRemove={removeBanner} />
      )}

      {editing && (
        <SlotEditorDialog
          /* Remount per slot/banner so the dialog re-seeds its fields from the
             record instead of syncing to it in an effect. */
          key={`${editing.slot.placement}-${editing.banner?.id ?? 'new'}`}
          slot={editing.slot}
          banner={editing.banner}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          nextSortOrder={(bySlot.get(editing.slot.placement) ?? []).length}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Remove this from the hero?"
        description="The banner is deleted. This cannot be undone."
        confirmLabel="Remove"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

/** A titled region for one slot type, carrying its size guidance and add action. */
function SlotSection({
  slot,
  count,
  onAdd,
  atCapacityNote,
  children,
}: {
  slot: HeroSlot
  count: number
  /** Undefined means the slot is full — the add action is not offered. */
  onAdd?: () => void
  atCapacityNote?: string
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {slot.label}
            {slot.capacity !== null && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {count} of {slot.capacity}
              </span>
            )}
          </span>
          {/* The spec's exact requirement: the pixel size, beside the control
              that uploads it, before the merchant picks a file. */}
          <span className="text-xs text-muted-foreground">
            Upload <span className="font-medium text-foreground">{formatSize(slot.recommended)}</span>
            {' · '}
            {formatRatio(slot.recommended)}
          </span>
        </div>
        {onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> Add
          </Button>
        ) : (
          atCapacityNote && (
            <span className="max-w-56 text-right text-xs text-muted-foreground">{atCapacityNote}</span>
          )
        )}
      </div>
      {children}
    </Card>
  )
}

/** A proportioned placeholder, so an empty slot reads as the shape it will become. */
function EmptySlot({ slot, onAdd }: { slot: HeroSlot; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{ aspectRatio: `${slot.recommended.width} / ${slot.recommended.height}` }}
      className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
    >
      <Plus className="size-5" />
      <span className="text-xs font-medium">Add {slot.label.toLowerCase()}</span>
      <span className="text-[11px]">{formatSize(slot.recommended)}</span>
    </button>
  )
}

interface DragHandleProps {
  draggable: true
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

/** One configured slot: its artwork at the slot's true ratio, plus its state. */
function SlotTile({
  banner,
  slot,
  dragHandleProps,
  onEdit,
  onRemove,
}: {
  banner: Banner
  slot: HeroSlot
  dragHandleProps?: DragHandleProps
  onEdit: () => void
  onRemove: () => void
}) {
  const isLive = banner.status === 'ACTIVE'
  /*
   * Driven by the stored status, not by comparing `startsAt` to the clock.
   * Reading the current time during render is impure — and the merchant sets
   * SCHEDULED deliberately, so the status is the more honest signal anyway.
   */
  const scheduledFor = banner.status === 'SCHEDULED' ? banner.startsAt : null

  return (
    <div className="group relative overflow-hidden rounded-md border border-border" {...dragHandleProps}>
      <div
        style={{ aspectRatio: `${slot.recommended.width} / ${slot.recommended.height}` }}
        className="w-full bg-muted"
      >
        {banner.image ? (
          <img
            src={banner.image}
            alt=""
            /* Dimmed when the storefront is not showing it, so "why isn't this
               live?" is answerable at a glance rather than by opening each one. */
            className={cn('h-full w-full object-cover', !isLive && 'opacity-40 grayscale')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-5" />
          </div>
        )}
      </div>

      <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
        {dragHandleProps && (
          <span className="cursor-grab rounded bg-background/90 p-1 text-muted-foreground shadow-sm">
            <GripVertical className="size-3.5" />
          </span>
        )}
        {!isLive && (
          <Badge variant={banner.status === 'SCHEDULED' ? 'warning' : 'secondary'}>
            {banner.status}
          </Badge>
        )}
      </div>

      {scheduledFor && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] text-muted-foreground shadow-sm">
          <CalendarClock className="size-3" />
          Live {formatDateTime(scheduledFor)}
        </span>
      )}

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button size="icon" variant="secondary" className="size-7" onClick={onEdit} aria-label="Edit slot">
          <Pencil className="size-3.5" />
        </Button>
        <Button size="icon" variant="destructive" className="size-7" onClick={onRemove} aria-label="Remove slot">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Drag-to-reorder over the native HTML5 API.
 *
 * A drag library would be a new dependency for what is, here, a handful of
 * image tiles in one row — the panel has no other sortable surface to amortise
 * it against. `onReorder` is called with the new array so the caller can write
 * `sortOrder` back.
 */
function ReorderableRow({
  items,
  onReorder,
  renderItem,
  className,
  trailing,
}: {
  items: Banner[]
  onReorder: (ordered: Banner[]) => void
  renderItem: (banner: Banner, dragHandleProps: DragHandleProps) => React.ReactNode
  className?: string
  trailing?: React.ReactNode
}) {
  // State rather than a ref: the tiles re-render on drag anyway, and a ref read
  // while building these handlers would be a render-time ref access.
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const makeHandleProps = (index: number): DragHandleProps => ({
    draggable: true,
    onDragStart: () => setDragIndex(index),
    // Without preventDefault the browser refuses the drop outright — the
    // default for a dragover is "not a valid target".
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      setDragIndex(null)
      if (dragIndex === null || dragIndex === index) return
      onReorder(moveItem(items, dragIndex, index))
    },
    onDragEnd: () => setDragIndex(null),
  })

  return (
    <div className={className}>
      {items.map((banner, index) => (
        <React.Fragment key={banner.id}>{renderItem(banner, makeHandleProps(index))}</React.Fragment>
      ))}
      {trailing}
    </div>
  )
}

/**
 * Hero banners the storefront will not render because their slot is already
 * full. Shown rather than hidden — see the comment on `overflow` above.
 */
function OverflowStrip({
  banners,
  onReslot,
  onRemove,
}: {
  banners: Banner[]
  onReslot: (banner: Banner, placement: BannerPlacement) => void
  onRemove: (banner: Banner) => void
}) {
  return (
    <Card className="flex flex-col gap-3 border-warning/40 p-3">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">Not shown on the storefront</span>
          <span className="text-xs text-muted-foreground">
            These are assigned to a hero slot that is already full, so the homepage skips them. Move one
            into a different slot or remove it.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {banners.map((banner) => {
          const slot = getHeroSlot(banner.placement)
          return (
            <div key={banner.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              {banner.image ? (
                <img src={banner.image} alt="" className="h-12 w-20 shrink-0 rounded border border-border object-cover" />
              ) : (
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                  <ImageOff className="size-4" />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{banner.title ?? 'Untitled'}</span>
                <span className="text-xs text-muted-foreground">
                  {slot?.label ?? banner.placement} · order {banner.sortOrder}
                </span>
              </div>

              <Select value="" onValueChange={(v) => onReslot(banner, v as BannerPlacement)}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  {HERO_SLOTS.map((s) => (
                    <SelectItem key={s.placement} value={s.placement}>
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="size-3" /> {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button size="icon" variant="ghost" className="size-8" onClick={() => onRemove(banner)} aria-label="Delete banner">
                <Trash2 className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
