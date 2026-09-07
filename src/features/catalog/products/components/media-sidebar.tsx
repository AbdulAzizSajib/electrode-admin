import * as React from 'react'
import { Film, Image as ImageIcon, Loader2, Plus, Star, Trash2, Upload } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import {
  ImageUploadField,
  SHARED_VARIANT_KEY,
  type PendingImage,
} from '@/features/catalog/products/components/image-upload-field'
import { useUploadVideo } from '@/lib/api/uploads'
import { cn } from '@/lib/utils/cn'

/**
 * The media column beside the product form: main image, video, gallery.
 *
 * A sidebar rather than a step, because a merchant writing a description wants
 * to see the photograph they are describing. Its three sections are the three
 * questions a merchant actually asks — what does the card show, is there a
 * video, and what else is there to look at.
 */

export interface ImageRow {
  id?: string
  url: string
  altText?: string
  isPrimary: boolean
  /** Which variant it depicts; the shared sentinel means the product as a whole. */
  variantKey?: string
}

export interface MediaSidebarProps {
  images: ImageRow[]
  onImagesChange: (images: ImageRow[]) => void

  pendingImages: PendingImage[]
  onPendingImagesChange: (pending: PendingImage[]) => void

  video: string | null
  videoThumbnail: string | null
  onVideoChange: (video: { url: string | null; thumbnailUrl: string | null }) => void

  /**
   * The gallery is only offered once the product exists — an image attaches to
   * a product, and the merchant is told so rather than shown dead controls.
   */
  productExists: boolean
}

/** A URL thumbnail that degrades to a placeholder rather than a broken image. */
function Thumb({ url, className }: { url?: string; className?: string }) {
  const [failed, setFailed] = React.useState(false)

  if (!url || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-border bg-muted',
          className,
        )}
      >
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className={cn('rounded-md border border-border object-cover', className)}
    />
  )
}

export function MediaSidebar({
  images,
  onImagesChange,
  pendingImages,
  onPendingImagesChange,
  video,
  videoThumbnail,
  onVideoChange,
  productExists,
}: MediaSidebarProps) {
  const uploadMutation = useUploadVideo()
  const videoInputRef = React.useRef<HTMLInputElement>(null)
  const posterInputRef = React.useRef<HTMLInputElement>(null)
  const [poster, setPoster] = React.useState<File | null>(null)

  const primary = images.find((image) => image.isPrimary)
  const hasPrimaryUrl = Boolean(primary)

  /*
   * A file picked in this session has no address yet, so previewing it needs an
   * object URL — and one that is revoked when the file changes, or every pick
   * leaks a blob for the life of the page.
   */
  const pendingPrimary = pendingImages.find((p) => p.isPrimary)?.file
  const pendingPrimaryUrl = React.useMemo(
    () => (pendingPrimary ? URL.createObjectURL(pendingPrimary) : undefined),
    [pendingPrimary],
  )
  React.useEffect(() => {
    if (!pendingPrimaryUrl) return
    return () => URL.revokeObjectURL(pendingPrimaryUrl)
  }, [pendingPrimaryUrl])

  /** At most one image is primary, across both URL rows and pending uploads. */
  const makePrimary = (index: number) => {
    onImagesChange(images.map((image, i) => ({ ...image, isPrimary: i === index })))
    onPendingImagesChange(pendingImages.map((p) => ({ ...p, isPrimary: false })))
  }

  const handleVideoPicked = async (file: File) => {
    try {
      const uploaded = await uploadMutation.mutateAsync({ video: file, thumbnail: poster })
      onVideoChange({ url: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl })
      setPoster(null)
      toast({ title: 'Video uploaded' })
    } catch (err) {
      toast({
        title: 'Could not upload the video',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Main image</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Thumb url={primary?.url ?? pendingPrimaryUrl} className="aspect-square w-full" />
          <p className="text-xs text-muted-foreground">
            Shown on the product card. Whichever image is starred below is the main one.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Film className="size-4" /> Video
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {video ? (
            <>
              <video
                src={video}
                poster={videoThumbnail ?? undefined}
                controls
                className="w-full rounded-md border border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onVideoChange({ url: null, thumbnailUrl: null })}
              >
                <Trash2 className="size-4" /> Remove video
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Pick a poster frame first if you want a specific one — otherwise a frame is taken
                from the video itself.
              </p>
              <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => setPoster(event.target.files?.[0] ?? null)}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // Reset so picking the same file twice still fires a change.
                  event.target.value = ''
                  if (file) void handleVideoPicked(file)
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => posterInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <ImageIcon className="size-4" /> {poster ? 'Poster chosen' : 'Poster frame'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload video
                </Button>
              </div>
              {poster && (
                <p className="text-xs text-muted-foreground">
                  {poster.name} will be used as the poster frame.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gallery</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!productExists ? (
            <Alert title="Available after saving">
              Gallery images attach to a product, so this becomes available once the product
              exists. Save it and you can add them here without leaving the page.
            </Alert>
          ) : (
            <>
              <ImageUploadField
                label="Upload from your device"
                pending={pendingImages}
                onChange={(next) => {
                  onPendingImagesChange(next)
                  // Only one primary across both lists.
                  if (next.some((p) => p.isPrimary)) {
                    onImagesChange(images.map((image) => ({ ...image, isPrimary: false })))
                  }
                }}
                hasPrimaryElsewhere={hasPrimaryUrl}
              />

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="text-xs font-semibold text-muted-foreground">Or link by URL</span>
                {images.map((image, index) => (
                  <div
                    key={image.id ?? `url-${index}`}
                    className="flex items-start gap-2 rounded-md border border-border p-2"
                  >
                    <Thumb url={image.url} className="size-12 shrink-0" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      {/* A placeholder is not an accessible name, and it
                          disappears the moment the field is typed in — so each
                          input names itself, numbered because the gallery holds
                          several identical-looking rows. */}
                      <Input
                        value={image.url}
                        placeholder="https://…"
                        aria-label={`Image ${index + 1} address`}
                        className="h-7 text-xs"
                        onChange={(event) =>
                          onImagesChange(
                            images.map((row, i) =>
                              i === index ? { ...row, url: event.target.value } : row,
                            ),
                          )
                        }
                      />
                      <Input
                        value={image.altText ?? ''}
                        placeholder="Alt text"
                        aria-label={`Image ${index + 1} alt text`}
                        className="h-7 text-xs"
                        onChange={(event) =>
                          onImagesChange(
                            images.map((row, i) =>
                              i === index ? { ...row, altText: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Make main image"
                        onClick={() => makePrimary(index)}
                      >
                        <Star
                          className={cn(
                            'size-4',
                            image.isPrimary && 'fill-amber-400 text-amber-400',
                          )}
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove image"
                        onClick={() => onImagesChange(images.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    onImagesChange([
                      ...images,
                      {
                        url: '',
                        altText: '',
                        isPrimary: images.length === 0 && pendingImages.length === 0,
                        variantKey: SHARED_VARIANT_KEY,
                      },
                    ])
                  }
                >
                  <Plus className="size-4" /> Add image URL
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
