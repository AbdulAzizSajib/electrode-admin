import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SingleImageField } from '@/components/forms/single-image-field'
import { toast } from '@/components/ui/use-toast'
import {
  checkDimensions,
  formatRatio,
  formatSize,
  readImageDimensions,
  MOBILE_ARTWORK,
  type DimensionWarning,
  type HeroSlot,
} from '@/features/ui/home-slider/hero-slots'
import {
  useCreateBanner,
  useUpdateBanner,
  BANNER_STATUSES,
  type Banner,
  type BannerInput,
  type BannerStatus,
} from '@/lib/api/banners'
import { useProducts } from '@/lib/api/products'

/**
 * Edits one hero slot without leaving the layout.
 *
 * A merchant arranging the hero is working visually — sending them to a
 * full-page form and back for every artwork swap loses the thing that makes
 * this manager worth having, which is seeing the change in place.
 *
 * Writes through the ordinary banner endpoints: a hero slot IS a Banner, and
 * this is a different view over it, not a different record. See design.md,
 * "Hero slots stay `Banner` rows".
 */

interface SlotEditorDialogProps {
  slot: HeroSlot
  /** The banner being edited, or null when filling an empty slot. */
  banner: Banner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Applied to a newly created banner so it lands in the position the merchant clicked. */
  nextSortOrder?: number
}

type LinkMode = 'url' | 'product'

export function SlotEditorDialog({
  slot,
  banner,
  open,
  onOpenChange,
  nextSortOrder = 0,
}: SlotEditorDialogProps) {
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const { data: productsData } = useProducts({ limit: 100 })
  const products = productsData?.data ?? []

  /*
   * Seeded straight from the banner rather than synced to it in an effect. The
   * parent gives this component a `key` derived from the banner id, so opening
   * a different slot remounts it and these initialisers run again — which is
   * React's own answer to "reset state when a prop changes", and avoids the
   * cascading render an effect-then-setState would cause.
   */
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const [mobileImageFile, setMobileImageFile] = React.useState<File | null>(null)
  const [imageWarning, setImageWarning] = React.useState<DimensionWarning | null>(null)
  const [linkMode, setLinkMode] = React.useState<LinkMode>(banner?.productId ? 'product' : 'url')
  const [link, setLink] = React.useState(banner?.link ?? '')
  const [productId, setProductId] = React.useState(banner?.productId ?? '')
  const [status, setStatus] = React.useState<BannerStatus>(banner?.status ?? 'ACTIVE')
  // `datetime-local` wants "YYYY-MM-DDTHH:mm"; the API returns full ISO.
  const [startsAt, setStartsAt] = React.useState(banner?.startsAt ? banner.startsAt.slice(0, 16) : '')
  const [endsAt, setEndsAt] = React.useState(banner?.endsAt ? banner.endsAt.slice(0, 16) : '')
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const handleImagePick = async (file: File | null) => {
    setImageFile(file)
    setImageWarning(null)
    if (!file) return
    try {
      setImageWarning(checkDimensions(slot, await readImageDimensions(file)))
    } catch {
      // An unreadable file is the upload's problem to report, not this
      // check's — the warning is advisory and its absence must never block.
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const hasArtwork = Boolean(imageFile || banner?.image)

  const save = async () => {
    setSaveError(null)

    if (!hasArtwork) {
      setSaveError('Add artwork for this slot before saving.')
      return
    }

    const input: BannerInput = {
      type: 'IMAGE',
      placement: slot.placement,
      status,
      sortOrder: banner?.sortOrder ?? nextSortOrder,
    }

    // Exactly one of the two link routes is sent. Sending both would leave the
    // storefront's resolvedLink silently preferring the product and the typed
    // URL looking ignored.
    if (linkMode === 'product') {
      if (productId) input.productId = productId
    } else if (link.trim()) {
      input.link = link.trim()
    }

    if (startsAt) input.startsAt = new Date(startsAt).toISOString()
    if (endsAt) input.endsAt = new Date(endsAt).toISOString()

    try {
      if (banner) {
        await updateMutation.mutateAsync({ id: banner.id, input, imageFile, mobileImageFile })
      } else {
        await createMutation.mutateAsync({ input, imageFile, mobileImageFile })
      }
      toast({ title: banner ? 'Slot updated' : 'Slot added' })
      onOpenChange(false)
    } catch (err) {
      // Kept in the dialog rather than a toast: the merchant's unsaved values
      // are still on screen and the message belongs next to them.
      setSaveError(err instanceof Error ? err.message : 'Could not save this slot.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{banner ? `Edit ${slot.label.toLowerCase()}` : `Add ${slot.label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>{slot.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Artwork</Label>
            <p className="text-xs text-muted-foreground">
              Recommended <span className="font-medium text-foreground">{formatSize(slot.recommended)}</span>
              {' · '}
              {formatRatio(slot.recommended)}
              {' · renders at '}
              {formatSize(slot.rendered)}
            </p>
            <SingleImageField
              value={imageFile}
              onChange={handleImagePick}
              currentUrl={banner?.image}
              label="Upload artwork"
            />
            {imageWarning && (
              <p className="flex items-start gap-1.5 rounded-md bg-warning-bg p-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{imageWarning.message}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mobile artwork (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Recommended <span className="font-medium text-foreground">{formatSize(MOBILE_ARTWORK)}</span>. Left
              empty, the desktop artwork is used.
            </p>
            <SingleImageField
              value={mobileImageFile}
              onChange={setMobileImageFile}
              currentUrl={banner?.mobileImage}
              label="Upload mobile artwork"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Links to</Label>
            <Select value={linkMode} onValueChange={(v) => setLinkMode(v as LinkMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url">A web address</SelectItem>
                <SelectItem value="product">A product</SelectItem>
              </SelectContent>
            </Select>
            {linkMode === 'url' ? (
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/products?sort=new"
              />
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as BannerStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANNER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only an ACTIVE slot inside its schedule appears on the storefront.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Goes live</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Label className="mt-1">Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save slot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
