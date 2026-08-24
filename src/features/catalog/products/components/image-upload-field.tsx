import * as React from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

/** A locally-picked file pending upload, plus the metadata that becomes its `imageSlots[i]` entry. */
export interface PendingImage {
  file: File
  /** Stable per-file key for React list identity and revoking its preview URL — not sent to the API. */
  key: string
  altText: string
  isPrimary: boolean
}

export interface ImageUploadFieldProps {
  pending: PendingImage[]
  onChange: (pending: PendingImage[]) => void
  /** Whether any existing/URL-based image in the form is already marked primary — informs the "first upload defaults to primary" rule. */
  hasPrimaryElsewhere: boolean
}

/**
 * File picker for product images, uploaded via the create/update multipart request (see
 * `ProductImageUpload` in `lib/api/products.ts`) — a separate, additive input alongside the
 * existing URL-based image rows already on the form; neither replaces the other.
 */
export function ImageUploadField({ pending, onChange, hasPrimaryElsewhere }: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Preview URLs are derived from `pending`, not stored in it — revoke every one whenever the
  // list they were built from is replaced (file added/removed) or the field unmounts, so we
  // never leak object URLs for files no longer in the list.
  const previewUrls = React.useMemo(() => pending.map((p) => URL.createObjectURL(p.file)), [pending])
  React.useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [previewUrls])

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const noPrimaryYet = !hasPrimaryElsewhere && pending.every((p) => !p.isPrimary)
    const newEntries: PendingImage[] = Array.from(fileList).map((file, i) => ({
      file,
      key: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${i}`,
      altText: '',
      isPrimary: noPrimaryYet && i === 0,
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2">
        {pending.map((entry, index) => (
          <div
            key={entry.key}
            className="grid grid-cols-1 gap-2 rounded-md border border-border p-2.5 sm:grid-cols-[64px_1fr_90px_32px] sm:items-center"
          >
            <img
              src={previewUrls[index]}
              alt={entry.altText || entry.file.name}
              className="size-16 rounded-md border border-border object-cover"
            />
            <div className="flex flex-col gap-1.5">
              <span className="truncate text-xs text-muted-foreground">{entry.file.name}</span>
              <Input
                placeholder="Alt text"
                value={entry.altText}
                onChange={(e) => updateEntry(entry.key, { altText: e.target.value })}
              />
            </div>
            <div className="flex flex-row items-center gap-2">
              <Checkbox checked={entry.isPrimary} onCheckedChange={(checked) => checked && setPrimary(entry.key)} />
              <span className="text-sm font-normal text-foreground">Primary</span>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(entry.key)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => inputRef.current?.click()}>
        <ImagePlus /> Upload images
      </Button>
    </div>
  )
}
