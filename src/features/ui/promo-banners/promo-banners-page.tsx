import * as React from 'react'
import { useNavigate } from 'react-router'
import { GripVertical, ImageOff, Images, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  PROMO_BANNER_LAYOUTS,
  PROMO_GROUP_NAME_MAX_LENGTH,
  PROMO_LAYOUT_LABEL,
  PROMO_LAYOUT_TILE_COUNT,
  useCreatePromoBannerGroup,
  useDeletePromoBannerGroup,
  usePromoBannerGroups,
  useReorderPromoBannerGroups,
  useUpdatePromoBannerGroup,
  type PromoBannerGroup,
  type PromoBannerLayout,
} from '@/lib/api/promo-banner-groups'

export const PROMO_BANNERS_PATH = '/ui/promo-banners'

/**
 * The promotional strips on the home page — how many there are, what each is
 * called, and how many tiles each shows across.
 *
 * ── What this page owns, and what it does not ────────────────────────────
 *
 * It owns the GROUPS: creating, naming, reordering, choosing a layout, and
 * deleting. It does NOT own their artwork — a banner names its group, so a tile
 * is added by creating a banner on the Banners page and choosing this strip
 * there. One writer per relation, rather than two screens that could disagree
 * about which strip a banner is in.
 *
 * It also does not own WHERE a strip sits on the page or whether it is on. That
 * is the homepage section configuration, edited on Home Sections, which shows
 * one row per strip named after the name given here. The hero's layout picker
 * was moved to Home Slider for the same reason: a field written from two
 * screens has two answers.
 *
 * ── Why a mismatch warns instead of blocking ────────────────────────────
 *
 * A THREE strip holding two banners renders two tiles. That is a normal state —
 * a merchant mid-way through uploading — and refusing the save would deadlock
 * them: they could not remove a banner without first changing the layout, nor
 * change the layout without first adding banners. So the count is shown, a
 * mismatch is called out, and nothing is prevented.
 *
 * See server/openspec/changes/add-promo-banner-groups, design.md Decision 4.
 */
export default function PromoBannersPage() {
  const navigate = useNavigate()
  const { data: groups, isLoading, error } = usePromoBannerGroups()

  const createMutation = useCreatePromoBannerGroup()
  const updateMutation = useUpdatePromoBannerGroup()
  const reorderMutation = useReorderPromoBannerGroups()
  const deleteMutation = useDeletePromoBannerGroup()
  const confirmDialog = useConfirmDialog()

  const [newName, setNewName] = React.useState('')

  const list = groups ?? []

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return

    try {
      await createMutation.mutateAsync({ name })
      setNewName('')
      toast({
        title: 'Strip created',
        description: 'It has been added to your home page. Add banners to it from the Banners page.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not create the strip',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    }
  }

  const handleRename = async (group: PromoBannerGroup, name: string) => {
    const trimmed = name.trim()
    // Unchanged or emptied: nothing to save. An empty name is refused by the
    // server, so catching it here keeps the merchant from a pointless error.
    if (!trimmed || trimmed === group.name) return

    try {
      await updateMutation.mutateAsync({ id: group.id, input: { name: trimmed } })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not rename the strip',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    }
  }

  const handleLayout = async (group: PromoBannerGroup, layout: PromoBannerLayout) => {
    try {
      await updateMutation.mutateAsync({ id: group.id, input: { layout } })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not change the layout',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    }
  }

  const handleMove = async (from: number, to: number) => {
    if (to < 0 || to >= list.length) return

    const next = [...list]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)

    try {
      await reorderMutation.mutateAsync(next.map((group) => group.id))
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not reorder the strips',
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    }
  }

  /*
   * Held so the dialog's copy can name the strip and its image count. The
   * shared hook carries only the pending action, so the row being deleted has
   * to be remembered separately.
   */
  const [pendingDelete, setPendingDelete] = React.useState<PromoBannerGroup | null>(null)

  const handleDelete = (group: PromoBannerGroup) => {
    setPendingDelete(group)
    confirmDialog.confirm(async () => {
      try {
        await deleteMutation.mutateAsync(group.id)
        toast({ title: 'Strip deleted', description: 'Its banners were kept.' })
      } catch (e) {
        toast({
          variant: 'destructive',
          title: 'Could not delete the strip',
          description: e instanceof Error ? e.message : 'Please try again.',
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Promo banners"
        description="The promotional strips between the sections of your home page. Each strip shows one, two or three images across."
        actions={
          <Button size="lg" variant="outline" onClick={() => navigate('/ui/banners')}>
            <Images /> Banners
          </Button>
        }
      />

      <Card className="flex flex-col gap-3 p-4">
        <Label htmlFor="new-promo-strip">Add a strip</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="new-promo-strip"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreate()
              }
            }}
            placeholder="Week deals"
            maxLength={PROMO_GROUP_NAME_MAX_LENGTH}
            className="max-w-xs"
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || createMutation.isPending}
          >
            <Plus /> Add strip
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A name only you see — it tells your strips apart on the Home Sections page. New strips
          start showing three images across and appear at the bottom of your promo strips.
        </p>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load your promo strips.'}
        </p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="No promo strips yet"
          description="Add a strip above, then put banners in it from the Banners page."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((group, index) => (
            <PromoGroupCard
              key={group.id}
              group={group}
              index={index}
              count={list.length}
              onRename={(name) => void handleRename(group, name)}
              onLayout={(layout) => void handleLayout(group, layout)}
              onMove={(to) => void handleMove(index, to)}
              onDelete={() => handleDelete(group)}
              onAddBanners={() => navigate('/ui/banners/new')}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : 'Delete this strip?'}
        /*
         * Says plainly that the artwork survives. A merchant who believes
         * deleting a strip deletes the images they paid for will not delete a
         * strip they no longer want — and that is the one thing they cannot
         * find out by trying it.
         */
        description={
          pendingDelete && pendingDelete.bannerCount > 0
            ? `The ${pendingDelete.bannerCount} banner${pendingDelete.bannerCount === 1 ? '' : 's'} in this strip will be kept and become unassigned — you can put ${pendingDelete.bannerCount === 1 ? 'it' : 'them'} in another strip from the Banners page. The strip itself will be removed from your home page.`
            : 'This strip will be removed from your home page.'
        }
        confirmLabel="Delete strip"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}

function PromoGroupCard({
  group,
  index,
  count,
  onRename,
  onLayout,
  onMove,
  onDelete,
  onAddBanners,
}: {
  group: PromoBannerGroup
  index: number
  count: number
  onRename: (name: string) => void
  onLayout: (layout: PromoBannerLayout) => void
  onMove: (to: number) => void
  onDelete: () => void
  onAddBanners: () => void
}) {
  /*
   * A local draft so typing is not sent per keystroke — committed on blur and
   * on Enter.
   *
   * ADJUSTED DURING RENDER, not in an effect. A saved name arriving from
   * elsewhere (a rename that failed and rolled back, or a refetch) has to
   * replace the field's value, and doing that in `useEffect` renders once with
   * the stale value before correcting it — a visible flash, and the cascading
   * re-render React's lint rule flags. Comparing against the last name we
   * synced from is React's own documented pattern for a component whose state
   * derives from a prop.
   */
  const [name, setName] = React.useState(group.name)
  const [syncedName, setSyncedName] = React.useState(group.name)

  if (syncedName !== group.name) {
    setSyncedName(group.name)
    setName(group.name)
  }

  const expected = PROMO_LAYOUT_TILE_COUNT[group.layout]
  const mismatch = group.bannerCount !== expected

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={`promo-name-${group.id}`} className="sr-only">
            Strip name
          </Label>
          <Input
            id={`promo-name-${group.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onRename(name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            maxLength={PROMO_GROUP_NAME_MAX_LENGTH}
            className="max-w-sm font-medium"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{PROMO_LAYOUT_LABEL[group.layout].label}</Badge>
            <span>
              {group.bannerCount} image{group.bannerCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Move ${group.name} up`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            ↑
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Move ${group.name} down`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            ↓
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Add banners to ${group.name}`} onClick={onAddBanners}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${group.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 pl-7">
        <Label>Images across</Label>
        <SegmentedRadioGroup
          value={group.layout}
          onValueChange={(value) => onLayout(value as PromoBannerLayout)}
          options={PROMO_BANNER_LAYOUTS.map((layout) => ({
            value: layout,
            label: PROMO_LAYOUT_LABEL[layout].label,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          {PROMO_LAYOUT_LABEL[group.layout].description} Recommended image size{' '}
          <span className="text-foreground">{PROMO_LAYOUT_LABEL[group.layout].recommended}</span>.
        </p>

        {/*
          A WARNING, NEVER A BLOCK. See the page comment: refusing the save
          would leave a merchant unable to change either side of the mismatch.
        */}
        {mismatch && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {group.bannerCount === 0
              ? 'This strip has no images yet, so nothing shows on your home page. Add banners to it from the Banners page.'
              : `This strip shows ${expected} across but has ${group.bannerCount} image${group.bannerCount === 1 ? '' : 's'}. ${
                  group.bannerCount < expected
                    ? 'The row will have a gap.'
                    : 'The extra images will wrap onto another row.'
                }`}
          </p>
        )}
      </div>
    </Card>
  )
}
