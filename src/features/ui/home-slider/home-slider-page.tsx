import * as React from 'react'
import {
  CalendarClock,
  GripVertical,
  EyeOff,
  ImageOff,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
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
import {
  ReorderableList,
  type DragHandleProps,
} from '@/features/ui/components/reorderable-list'
import {
  HERO_GEOMETRY,
  HERO_PLACEMENTS,
  formatRatio,
  formatSize,
  getHeroSlot,
  heroSlots,
  unusedSlots,
  type HeroSlot,
} from '@/features/ui/home-slider/hero-slots'
import { VariantPicker } from '@/features/ui/home-slider/variant-picker'
import {
  useBanners,
  useDeleteBanner,
  useUpdateBanner,
  type Banner,
  type BannerPlacement,
} from '@/lib/api/banners'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  nearestContentWidth,
  DEFAULT_HOME_CONFIG,
  DEFAULT_SITE_CONTENT_WIDTH,
  FULL_WIDTH,
  HERO_VARIANT_OPTIONS,
  type HeroVariant,
} from '@/lib/api/store-settings'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

/**
 * The homepage hero, arranged the way the storefront arranges it.
 *
 * The point of this page over the flat banner list is that a merchant can see
 * WHICH box they are editing. Every slot is rendered at its true aspect ratio
 * (from `heroSlots(variant)`, measured off the storefront's own hero
 * components), so an empty promo tile looks like the wide strip it will become
 * rather than like another row in a table.
 *
 * THE ARRANGEMENT IS A MERCHANT SETTING, and this page is where it is chosen.
 * That promise above is only kept if the page draws the layout the store
 * actually uses — a store on the full-width slider shown a grid of a panel and
 * three tiles would be told something false about its own site. So the picker
 * lives here, beside the consequences, rather than on Home Sections where the
 * rest of `homeConfig` is edited. See design.md Decision 2.
 */
/**
 * One copy of three that had drifted: the loading and error headers promised
 * "as the storefront lays it out" while the loaded one added a second sentence
 * about artwork sizes — a sentence that is no longer true of this page, since
 * the sizes now live in the editor dialog beside the upload control.
 */
const PAGE_DESCRIPTION =
  'The homepage hero, laid out as the storefront renders it in the layout you have chosen. ' +
  'Each slot shows the pixel size to export its artwork at.'

export default function HomeSliderPage() {
  // One request for all three placements: `GET /banners/admin` returns every
  // region, and three filtered calls would be three round trips for the same
  // rows.
  const { data, isLoading, error, refetch } = useBanners({ limit: 100 })
  const updateMutation = useUpdateBanner()
  const deleteMutation = useDeleteBanner()
  const confirmDialog = useConfirmDialog()

  /*
   * The store's content width, for the "renders at" figures only — the shapes
   * on this page do not depend on it. That is the point of the proportional
   * hero: a slot keeps its ratio at every width, so this page can be drawn
   * before the settings request lands and the recommended sizes it prints stay
   * correct whatever comes back.
   */
  const { data: settings, refetch: refetchSettings } = useStoreSettings()
  const updateSettings = useUpdateStoreSettings()
  const storedWidth = settings?.theme?.maxWidth
  const contentWidth: number | 'full' =
    storedWidth === FULL_WIDTH
      ? FULL_WIDTH
      : nearestContentWidth(
          typeof storedWidth === 'number' ? storedWidth : DEFAULT_SITE_CONTENT_WIDTH,
        )

  /*
   * The store's hero arrangement, and the thing every shape on this page is
   * derived from.
   *
   * NOT DEFAULTED HERE beyond the read itself: the backend resolves the layout
   * on every read, so a live payload always carries a valid one. The fallback
   * covers only the moment before the settings request lands, and it is the
   * same default the backend would have resolved to.
   */
  const variant: HeroVariant = settings?.homeConfig?.find((s) => s.key === 'HERO')?.variant ?? 'SPLIT_THREE'

  const slots = React.useMemo(() => heroSlots(variant), [variant])
  const unused = React.useMemo(() => unusedSlots(variant), [variant])

  const [editing, setEditing] = React.useState<{ slot: HeroSlot; banner: Banner | null } | null>(null)

  /**
   * The layout being written, or null.
   *
   * NOT `updateSettings.isPending`. `useUpdateStoreSettings` is one shared
   * mutation across every settings editor, so its pending flag is true while
   * ANY of them is saving — and it stays true for a mutation this page never
   * started. Disabling the picker on it makes the whole control dead for
   * reasons a merchant cannot see and clicking cannot clear, which is
   * indistinguishable from the picker being broken. This state is owned by this
   * page and cleared in a `finally`.
   */
  const [savingVariant, setSavingVariant] = React.useState<HeroVariant | null>(null)

  /**
   * Writes the chosen layout, and nothing else.
   *
   * REFETCHES FIRST. `homeConfig` is replaced wholesale by a save, and the Home
   * Sections page writes the same column — so building the payload from cached
   * state could discard a reordering made in another tab. Refetching narrows
   * that window to one round trip, and only the HERO entry's `variant` is
   * changed in what comes back. See design.md Decision 2.
   */
  const chooseVariant = async (next: HeroVariant) => {
    // Already the chosen layout — Radix fires `onValueChange` for a click on
    // the selected card too, and a save that writes the value already stored
    // would flash a success toast for a no-op.
    if (next === variant) return

    setSavingVariant(next)
    try {
      const fresh = await refetchSettings()
      const current = fresh.data?.homeConfig ?? settings?.homeConfig ?? DEFAULT_HOME_CONFIG

      await updateSettings.mutateAsync({
        homeConfig: current.map((section) =>
          section.key === 'HERO' ? { ...section, variant: next } : section,
        ),
      })

      toast({
        title: 'Hero layout updated',
        description: HERO_VARIANT_OPTIONS.find((o) => o.value === next)?.label,
      })
    } catch (err) {
      toast({
        title: 'Could not change the layout',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      // In a `finally`, so a refused save re-enables the picker. Left set, the
      // merchant's only way out of a failed layout change would be a page
      // reload.
      setSavingVariant(null)
    }
  }

  const bySlot = React.useMemo(() => {
    const all = data?.data ?? []
    const grouped = new Map<BannerPlacement, Banner[]>()
    // EVERY hero placement, not just the ones this layout renders — the unused
    // ones still have to be listed, or a merchant concludes their artwork was
    // deleted by the switch.
    for (const placement of HERO_PLACEMENTS) {
      grouped.set(
        placement,
        all.filter((b) => b.placement === placement).sort((a, b) => a.sortOrder - b.sortOrder),
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
    // Counted against THIS layout's capacities. Switching to an arrangement
    // that renders one side tile where the last rendered two pushes the second
    // into overflow, which is exactly what a merchant needs told.
    for (const slot of slots) {
      if (slot.capacity === null) continue
      extra.push(...(bySlot.get(slot.placement) ?? []).slice(slot.capacity))
    }
    return extra
  }, [bySlot, slots])

  /**
   * Banners sitting in a slot this layout does not render.
   *
   * KEPT AND SHOWN, in a group of their own. They are on file and untouched,
   * and the storefront renders them again the moment the merchant picks a
   * layout that uses them — but a merchant whose promo artwork simply vanished
   * from this screen would conclude the switch deleted it and re-upload
   * everything. See design.md Decision 4.
   */
  const unusedBanners = React.useMemo(
    () => unused.flatMap((placement) => bySlot.get(placement) ?? []),
    [bySlot, unused],
  )

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

  const sliderSlot = slots.find((s) => s.placement === 'HERO_SLIDER')
  const sideSlot = slots.find((s) => s.placement === 'HERO_SIDE')
  const promoSlot = slots.find((s) => s.placement === 'HERO_PROMO')

  /*
   * How this layout is laid out, which is also how this page draws it.
   *
   * The two split layouts put the slider beside a column; the two wide ones put
   * it across the top with any tiles in a row beneath. Drawing every layout the
   * first way would break this page's one promise — that a merchant can see
   * which box they are editing.
   */
  const stacked = HERO_GEOMETRY[variant].stacked === true
  const sideFraction = HERO_GEOMETRY[variant].sideColumnFraction ?? 0

  const slides = visible('HERO_SLIDER')
  const sideTiles = visible('HERO_SIDE')
  const [promoTile] = visible('HERO_PROMO')

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Home slider" description={PAGE_DESCRIPTION} />
        <Skeleton className="h-136 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Home slider" description={PAGE_DESCRIPTION} />
        <ErrorState
          description={error instanceof Error ? error.message : 'Could not load the hero.'}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Home slider" description={PAGE_DESCRIPTION} />

      <VariantPicker
        value={variant}
        onChange={(next) => void chooseVariant(next)}
        saving={savingVariant}
      />

      {/*
        Mirrors the storefront's hero FOR THE CHOSEN LAYOUT: the two split
        layouts put the slider beside a column, the two wide ones put it across
        the top with any tiles in a row beneath. The ratios come from
        `heroSlots(variant)`, so this page and the storefront cannot disagree
        about the shape of a slot — which is the only reason this page exists
        rather than the flat banner list.
      */}
      <div className={stacked ? 'flex flex-col gap-4' : 'flex flex-col gap-4 xl:flex-row'}>
        {sliderSlot && (
          <div className={stacked ? 'w-full' : 'min-w-0 flex-1'}>
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
                <ReorderableList
                  items={slides}
                  getKey={(banner) => banner.id}
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
        )}

        {(sideSlot || promoSlot) && (
          <div
            /*
             * The layout's own share of the row, NOT a fixed width.
             *
             * This was `xl:w-96` — a hardcoded 384px. It happened to look
             * right at one panel width, and at every other one the drawn
             * column stopped agreeing with the storefront's, so the page
             * showed an arrangement the storefront does not render — the one
             * thing it exists not to do.
             *
             * Read from `HERO_GEOMETRY.sideColumnFraction` (43% in SPLIT_THREE,
             * a third in SPLIT_TALL) through a CSS variable, so there is no
             * per-layout class here to fall out of step with the geometry or
             * with the storefront's `lg:w-[43%]` / `lg:w-1/3`.
             */
            style={stacked ? undefined : { ['--side' as string]: `${sideFraction * 100}%` }}
            className={
              stacked
                ? 'grid w-full grid-cols-1 gap-4 lg:grid-cols-2'
                : 'flex w-full flex-col gap-4 xl:w-(--side) xl:flex-none'
            }
          >
            {sideSlot && (
              <SlotSection
                slot={sideSlot}
                count={sideTiles.length}
                onAdd={
                  sideTiles.length < (sideSlot.capacity ?? Infinity)
                    ? () => setEditing({ slot: sideSlot, banner: null })
                    : undefined
                }
              >
                <ReorderableList
                  items={sideTiles}
                  getKey={(banner) => banner.id}
                  onReorder={persistOrder}
                  // One column when the layout renders one tile, so the single
                  // image is not drawn at half the width it will paint at.
                  className={
                    sideSlot.capacity === 1 ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'
                  }
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
                    sideTiles.length < (sideSlot.capacity ?? Infinity) ? (
                      <EmptySlot
                        slot={sideSlot}
                        onAdd={() => setEditing({ slot: sideSlot, banner: null })}
                      />
                    ) : null
                  }
                />
              </SlotSection>
            )}

            {promoSlot && (
              <SlotSection
                slot={promoSlot}
                count={promoTile ? 1 : 0}
                onAdd={promoTile ? undefined : () => setEditing({ slot: promoSlot, banner: null })}
              >
                {promoTile ? (
                  <SlotTile
                    banner={promoTile}
                    slot={promoSlot}
                    onEdit={() => setEditing({ slot: promoSlot, banner: promoTile })}
                    onRemove={() => removeBanner(promoTile)}
                  />
                ) : (
                  <EmptySlot
                    slot={promoSlot}
                    onAdd={() => setEditing({ slot: promoSlot, banner: null })}
                  />
                )}
              </SlotSection>
            )}
          </div>
        )}
      </div>

      {unusedBanners.length > 0 && (
        <UnusedSlotStrip banners={unusedBanners} onReslot={reslot} onRemove={removeBanner} />
      )}

      {overflow.length > 0 && (
        <OverflowStrip banners={overflow} variant={variant} onReslot={reslot} onRemove={removeBanner} />
      )}

      {editing && (
        <SlotEditorDialog
          /* Remount per slot/banner so the dialog re-seeds its fields from the
             record instead of syncing to it in an effect. */
          key={`${editing.slot.placement}-${editing.banner?.id ?? 'new'}`}
          slot={editing.slot}
          variant={variant}
          banner={editing.banner}
          contentWidth={contentWidth}
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

/**
 * The artwork size for one slot, as a merchant would type it into an editor.
 *
 * Deliberately a whole-pixel pair and nothing else. The figures come from
 * `heroSlots(variant)`, which STATES a round size per slot per layout rather
 * than deriving one — see hero-slots.ts, "Why stated upload sizes". Before
 * that, this line would have read "644 px × 644 px", and a badge a merchant
 * has to re-read is worse than no badge.
 *
 * THE ONLY PLACE THIS PAGE PRINTS A SIZE. `EmptySlot` used to print it as well,
 * which showed an empty slot the same figure twice — and via `formatSize`, so
 * the panel spells a size exactly one way wherever it appears.
 */
function SlotSizeBadge({ slot }: { slot: HeroSlot }) {
  return (
    <span
      title={`Export at ${formatSize(slot.recommended)} — aspect ratio ${formatRatio(slot.recommended)}`}
      className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground"
    >
      {formatSize(slot.recommended)}
    </span>
  )
}

/**
 * A titled region for one slot type, carrying its count, its artwork size and
 * its add action.
 *
 * THE SIZE IS ON THE HEADING, not only in the upload dialog. It sat in the
 * dialog alone for a while, on the reasoning that the spec asks for the size
 * beside the control that uploads it and three figures per section was the
 * densest line on the page. Both were true and the conclusion was wrong: a
 * merchant makes hero artwork BEFORE opening this panel, and a size that only
 * appears once they have already picked a file is a size they learn too late.
 * They would export at a guess, upload, read the crop warning, and go back to
 * their editor.
 *
 * So the heading carries the one figure that answers "what do I export" — the
 * pixel size and its ratio, and nothing else. The dialog still prints the full
 * three-part string with the store's own content width named, which is the
 * detail that genuinely belongs beside the file input rather than above the
 * whole section.
 *
 * The size shown is THIS LAYOUT'S. Every slot is sized by `heroSlots(variant)`,
 * so switching layout changes these numbers — which is the point of them.
 */
function SlotSection({
  slot,
  count,
  onAdd,
  children,
}: {
  slot: HeroSlot
  count: number
  /** Undefined means the slot is full — the add action is not offered. */
  onAdd?: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm font-medium text-foreground">
          {slot.label}
          {slot.capacity !== null && (
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {count} of {slot.capacity}
            </span>
          )}
          {/* What to export, for THIS layout. `title` carries the ratio rather
              than a second badge: the ratio matters when a merchant is deciding
              whether an existing file fits, which is a question they ask about
              one slot at a time, not while scanning the page. */}
          <SlotSizeBadge slot={slot} />
        </span>
        {/* At capacity the count above already says so — "2 of 2" beside a
            missing Add button is the same sentence as "The layout has exactly
            two side positions", in three characters instead of forty-eight. */}
        {onAdd && (
          <Button size="lg" variant="outline" onClick={onAdd}>
            <Plus /> Add
          </Button>
        )}
      </div>
      {children}
    </Card>
  )
}

/**
 * A proportioned placeholder, so an empty slot reads as the shape it will become.
 *
 * DOES NOT PRINT THE SIZE. `SlotSizeBadge` on the section heading directly
 * above carries it, and it carries it whether the slot is empty or full — so
 * printing it here too showed an empty slot the same figure twice, two lines
 * apart and in two different formats ("1400 × 1400 px" against
 * "1400 px × 1400 px"). A merchant reading the same number twice stops to work
 * out which one is the real one.
 *
 * The SHAPE is still stated here, by `aspectRatio` — which is the thing a
 * placeholder can say that a badge cannot.
 */
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
    </button>
  )
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
 * Hero banners in a slot the CHOSEN LAYOUT does not render.
 *
 * "Kept, not deleted" is the first thing this says, and that order matters. The
 * obvious implementation — filtering the slot list by the current layout — is
 * one line and produces a screen where a merchant's promo artwork has simply
 * vanished, from the page whose entire purpose is showing them where their
 * artwork is. They would conclude the switch destroyed it. It did not: the rows
 * are untouched, and the storefront renders them again unchanged the moment the
 * layout changes back.
 *
 * The rows stay fully editable, and the "Move to…" control is what a merchant
 * uses if they would rather bring the artwork into a slot this layout does use.
 *
 * See openspec/changes/add-hero-section-variants-admin, design.md Decision 4.
 */
function UnusedSlotStrip({
  banners,
  onReslot,
  onRemove,
}: {
  banners: Banner[]
  onReslot: (banner: Banner, placement: BannerPlacement) => void
  onRemove: (banner: Banner) => void
}) {
  return (
    <Card className="flex flex-col gap-3 p-3" data-testid="unused-slot-strip">
      <div className="flex items-center gap-2">
        <EyeOff className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-foreground">
          <span className="font-medium">Kept, but not used by this layout.</span>{' '}
          <span className="text-muted-foreground">
            Nothing has been deleted — switch back and these appear again exactly as they were.
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {banners.map((banner) => (
          <UnusedRow
            key={banner.id}
            banner={banner}
            onReslot={onReslot}
            onRemove={onRemove}
          />
        ))}
      </div>
    </Card>
  )
}

/** One row of the unused group, and of the overflow strip below it. */
function UnusedRow({
  banner,
  onReslot,
  onRemove,
  slotLabel,
}: {
  banner: Banner
  onReslot: (banner: Banner, placement: BannerPlacement) => void
  onRemove: (banner: Banner) => void
  slotLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2">
      {banner.image ? (
        <img
          src={banner.image}
          alt=""
          className="h-12 w-20 shrink-0 rounded border border-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
          <ImageOff className="size-4" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{banner.title ?? 'Untitled'}</span>
        <span className="text-xs text-muted-foreground">{slotLabel ?? banner.placement}</span>
      </div>

      <Select value="" onValueChange={(v) => onReslot(banner, v as BannerPlacement)}>
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="Move to…" />
        </SelectTrigger>
        <SelectContent>
          {HERO_PLACEMENTS.map((placement) => (
            <SelectItem key={placement} value={placement}>
              {placement === 'HERO_SLIDER'
                ? 'Hero slider'
                : placement === 'HERO_SIDE'
                  ? 'Side tile'
                  : 'Promo tile'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={() => onRemove(banner)}
        aria-label="Delete banner"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

/**
 * Hero banners the storefront will not render because their slot is already
 * full FOR THE CURRENT LAYOUT. Shown rather than hidden — see the comment on
 * `overflow` above.
 */
function OverflowStrip({
  banners,
  variant,
  onReslot,
  onRemove,
}: {
  banners: Banner[]
  variant: HeroVariant
  onReslot: (banner: Banner, placement: BannerPlacement) => void
  onRemove: (banner: Banner) => void
}) {
  return (
    <Card className="flex flex-col gap-3 border-warning/40 p-3" data-testid="overflow-strip">
      {/* One sentence, not a heading plus a paragraph that restated it. The
          controls on each row already say what to do about it — a closing
          "Move one into a different slot or remove it" narrated the two
          affordances sitting directly beneath. */}
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0 text-warning" />
        <span className="text-sm text-foreground">
          <span className="font-medium">Not shown on the storefront.</span>{' '}
          <span className="text-muted-foreground">
            Their slot is already full in the layout you have chosen.
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {banners.map((banner) => (
          <UnusedRow
            key={banner.id}
            banner={banner}
            /* Slot only. `order {sortOrder}` was the row's stored sort index —
               a number a merchant cannot act on, and a misleading one here,
               since these banners are not in any order the storefront reads. */
            slotLabel={getHeroSlot(variant, banner.placement)?.label}
            onReslot={onReslot}
            onRemove={onRemove}
          />
        ))}
      </div>
    </Card>
  )
}
