import * as React from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SingleImageFieldProps {
  /** The locally-picked file pending upload, or null when nothing is picked. */
  value: File | null
  onChange: (file: File | null) => void
  /**
   * Artwork already stored on the record, shown when no new file is picked so an edit form makes
   * clear what is currently set rather than looking empty.
   */
  currentUrl?: string | null
  label?: string
}

/**
 * One-file image picker for records whose artwork is a single field — brand logos, category
 * images/banners. The multi-file equivalent for products lives in
 * `features/catalog/products/components/image-upload-field.tsx`; this one is deliberately separate
 * because it carries none of that component's per-image alt-text/primary metadata.
 *
 * Picking a file here does not replace the form's URL input: the backend accepts either a
 * multipart upload or a pre-hosted URL string, and both remain available.
 */
export function SingleImageField({ value, onChange, currentUrl, label = 'Upload image' }: SingleImageFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Derived from `value`, never stored — so the URL for a replaced file is always revoked.
  const previewUrl = React.useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const shownUrl = previewUrl ?? currentUrl ?? null

  const clear = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      {shownUrl && (
        <div className="flex flex-row items-center gap-2.5">
          <img src={shownUrl} alt="" className="size-16 rounded-md border border-border object-cover" />
          <div className="flex flex-col gap-1">
            <span className="truncate text-xs text-muted-foreground">
              {value ? value.name : 'Current image'}
            </span>
            {value && (
              <Button type="button" variant="ghost" size="lg" className="self-start" onClick={clear}>
                <Trash2 className="size-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <Button type="button" size="lg" variant="outline" className="self-start" onClick={() => inputRef.current?.click()}>
        <ImagePlus /> {value ? 'Change file' : label}
      </Button>
    </div>
  )
}
