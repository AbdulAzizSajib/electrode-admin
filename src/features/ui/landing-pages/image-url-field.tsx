import * as React from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { useUploadImage } from '@/lib/api/uploads'

/**
 * An image field whose VALUE is the stored URL.
 *
 * Distinct from `SingleImageField`, which hands the caller a `File` to upload
 * as part of a multipart save. The landing page's images live inside JSON
 * columns sent as a plain body, so each one has to already be a URL by the time
 * the form is submitted — this uploads on pick and puts the resulting URL into
 * the field.
 *
 * The text input stays visible beside the upload button: the backend accepts a
 * pre-hosted URL just as happily, and a merchant reusing artwork they already
 * host should not have to re-upload it to satisfy this control.
 *
 * Both props are optional so the field can be rendered without a form around
 * it — in a test harness, or anywhere its value is not yet decided. A
 * `FormField` always supplies both.
 */
export function ImageUrlField({
  value = '',
  onChange = () => {},
  placeholder = 'https://…',
}: {
  value?: string
  onChange?: (next: string) => void
  placeholder?: string
} = {}) {
  const uploadImage = useUploadImage()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const { url } = await uploadImage.mutateAsync(file)
      onChange(url)
    } catch (err) {
      toast({
        title: 'Could not upload that image',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      // Cleared so picking the same file twice in a row still fires `change`.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          Upload
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => onChange('')}
            aria-label="Clear image"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      {value && (
        <img
          src={value}
          alt=""
          className="size-20 rounded-md border border-border object-cover"
        />
      )}
    </div>
  )
}
