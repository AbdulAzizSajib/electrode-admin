import * as React from 'react'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

/**
 * Marks an image as belonging to the product rather than to one variant. Must
 * match the constant of the same name in `product-form-page.tsx`, which owns
 * resolution. A non-empty sentinel (rather than `undefined`) keeps "explicitly
 * shared" distinguishable from "not yet assigned" when scoping upload lists.
 */
export const SHARED_VARIANT_KEY = '__shared__'

/** A locally-picked file pending upload, plus the metadata that becomes its `imageSlots[i]` entry. */
export interface PendingImage {
  file: File
  /** Stable per-file key for React list identity and revoking its preview URL — not sent to the API. */
  key: string
  altText: string
  isPrimary: boolean
  /**
   * Which variant this file depicts; `SHARED_VARIANT_KEY` (the default) means
   * all of them. Set by *where the file was picked* — the product-level
   * uploader marks files shared, a variant row's uploader stamps its own key —
   * so there is no per-row picker to keep in sync.
   */
  variantKey?: string
}

export interface ImageUploadFieldProps {
  pending: PendingImage[]
  onChange: (pending: PendingImage[]) => void
  /** Whether any existing/URL-based image in the form is already marked primary — informs the "first upload defaults to primary" rule. */
  hasPrimaryElsewhere: boolean
  /**
   * Variant this uploader files its images under. Omitted at product level,
   * where uploads are shared across every variant.
   */
  variantKey?: string
  /** Hides the primary control where choosing one makes no sense (variant-scoped galleries). */
  showPrimary?: boolean
  /** Compact layout for embedding inside a variant row. */
  compact?: boolean
  label?: string
}

/**
 * File picker for product images, uploaded via the create/update multipart request (see
 * `ProductImageUpload` in `lib/api/products.ts`) — a separate, additive input alongside the
 * existing URL-based image rows already on the form; neither replaces the other.
 *
 * Renders only the files belonging to its own scope (`variantKey`), and edits
 * the shared `pending` list in place so the parent keeps one flat array to submit.
 */
export function ImageUploadField({
  pending,
  onChange,
  hasPrimaryElsewhere,
  variantKey,
  showPrimary = true,
  compact = false,
  label,
}: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const scope = variantKey ?? SHARED_VARIANT_KEY

  // Preview URLs are derived from `pending`, not stored in it — revoke every one whenever the
  // list they were built from is replaced (file added/removed) or the field unmounts, so we
  // never leak object URLs for files no longer in the list.
  const previewUrls = React.useMemo(() => pending.map((p) => URL.createObjectURL(p.file)), [pending])
  React.useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [previewUrls])

  // Indices into the full `pending` array, so edits below address the real entry
  // rather than a position within the filtered view.
  const visible = pending
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => (entry.variantKey ?? SHARED_VARIANT_KEY) === scope)

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const noPrimaryYet = !hasPrimaryElsewhere && pending.every((p) => !p.isPrimary)
    const newEntries: PendingImage[] = Array.from(fileList).map((file, i) => ({
      file,
      key: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${i}`,
      altText: '',
      // Only the product-level uploader can mint the primary image; a
      // variant-scoped one never claims it.
      isPrimary: showPrimary && noPrimaryYet && i === 0,
      variantKey: scope,
    }))
    onChange([...pending, ...newEntries])
    if (inputRef.current) inputRef.current.value = ''
  }

  const updateEntry = (key: string, patch: Partial<PendingImage>) => {
    onChange(pending.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  const setPrimary = (key: string) => {
    onChange(pending.map((p) => ({ ...p, isPrimary: p.key === key })))
  }

  const removeEntry = (key: string) => {
    onChange(pending.filter((p) => p.key !== key))
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}

      {visible.length > 0 && (
        <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6')}>
          {visible.map(({ entry, index }) => (
            <div
              key={entry.key}
              className="group relative flex flex-col gap-1.5 rounded-md border border-border p-1.5"
            >
              <div className="relative">
                <img
                  src={previewUrls[index]}
                  alt={entry.altText || entry.file.name}
                  className="aspect-square w-full rounded-sm border border-border object-cover"
                />
                {/* Overlay controls, so each tile stays compact instead of
                    spreading its actions across a full-width row. */}
                <div className="absolute right-1 top-1 flex gap-1">
                  {showPrimary && (
                    <button
                      type="button"
                      title={entry.isPrimary ? 'Primary image' : 'Set as primary'}
                      onClick={() => setPrimary(entry.key)}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border shadow-sm transition-colors',
                        entry.isPrimary
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Star className={cn('size-3.5', entry.isPrimary && 'fill-current')} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove image"
                    onClick={() => removeEntry(entry.key)}
                    className="flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {entry.isPrimary && showPrimary && (
                  <span className="absolute bottom-1 left-1 rounded-sm bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                    Primary
                  </span>
                )}
              </div>
              <Input
                placeholder="Alt text"
                className="h-7 text-xs"
                value={entry.altText}
                onChange={(e) => updateEntry(entry.key, { altText: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {/*
        Hidden with absolute positioning rather than `display:none`. antd v6
        injected a reset stylesheet at runtime with higher specificity than
        Tailwind's single-class `.hidden`, which left the raw "Choose Files"
        control visible beside the styled button. antd is gone, but positioning
        it off-screen also keeps the input focusable, which `display:none` does
        not — so this stays.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus /> {visible.length > 0 ? 'Add more' : 'Upload images'}
      </Button>
    </div>
  )
}
