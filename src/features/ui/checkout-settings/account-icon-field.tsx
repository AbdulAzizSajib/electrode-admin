import * as React from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { useUploadImage } from '@/lib/api/uploads'

/**
 * The logo shown beside one payment account on the storefront's checkout page.
 *
 * A TILE, not the `ImageUrlField` the landing pages use, and the difference is
 * about where it sits rather than about what it does. That field is a URL input,
 * an Upload button, a Clear button and an 80px preview stacked into a column —
 * right for a form whose every field owns a row, and wrong here, where this has
 * to stand beside Service, Number and Account type inside one account row
 * without making that row three times taller. The tile is the preview, the
 * picker and the empty state at once, at the `h-9` the inputs beside it use.
 *
 * NO URL BOX, which is the one thing given up against `ImageUrlField`. A
 * merchant pasting an address they already host is a real case for a hero image
 * and an imagined one for a service logo — the artwork is bKash's, and whoever
 * has it has a file.
 *
 * The VALUE IS THE URL, uploaded on pick: `checkoutConfig` is PATCHed as JSON,
 * so nothing can ride along with the save as multipart the way a product image
 * does. Same arrangement as the store logo in Site Settings.
 */
export function AccountIconField({
  value,
  onChange,
  /** Names the account in the control's labels — "bKash 01712…". */
  accountLabel,
  inputId,
}: {
  value: string
  onChange: (next: string) => void
  accountLabel: string
  inputId: string
}) {
  const uploadImage = useUploadImage()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    try {
      const { url } = await uploadImage.mutateAsync(file)
      onChange(url)
    } catch (err) {
      toast({
        title: 'Could not upload that icon',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      // Cleared so picking the same file twice in a row still fires `change`.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-xs">
        Icon
      </Label>

      <div className="relative w-9">
        <button
          id={inputId}
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          aria-label={
            value ? `Replace the ${accountLabel} icon` : `Upload an icon for ${accountLabel}`
          }
          className="flex size-9 items-center justify-center overflow-hidden rounded-md border border-input bg-transparent text-muted-foreground shadow-xs outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : value ? (
            // Plain `img`: this is a merchant-supplied URL on an admin screen
            // behind a login, with no optimizer in front of it either way.
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
        </button>

        {/*
          Floats over the tile's corner rather than taking a column of its own:
          the row already carries three fields and two move buttons, and a fourth
          full control for "undo the optional thing" would be the widest thing on
          it. Shown only when there is something to remove.
        */}
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Remove the ${accountLabel} icon`}
            className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
