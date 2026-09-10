import * as React from 'react'
import { Image as ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useUploadImage, useUploadVideo } from '@/lib/api/uploads'
import { EMPTY_MEDIA, type BlogMedia } from '@/features/ui/blog/blog-media'

/**
 * The post's single media slot: nothing, an image, or a video.
 *
 * Modelled as a three-way CHOICE rather than as two independent uploads, because that is what makes
 * "image or video, never both" unreachable from the form rather than merely discouraged. Picking one
 * kind clears the other's URLs in the same interaction — the same arrangement the checkout editor
 * uses to clear a field's Required box when its Show is turned off, so the merchant never composes a
 * payload the backend will refuse and then has to decode a 400.
 *
 * Uploads go through the existing `POST /uploads/image` and `POST /uploads/video`. The video
 * endpoint derives a poster frame when none is supplied, which is why a video post always has a
 * thumbnail to render in a listing rather than a black rectangle.
 */

/**
 * Both props are optional so the field can be rendered without a form around it — in a test
 * harness, or anywhere its value is not yet decided. A `FormField` always supplies both.
 */
export function BlogMediaField({
  value = EMPTY_MEDIA,
  onChange = () => {},
}: {
  value?: BlogMedia
  onChange?: (next: BlogMedia) => void
} = {}) {
  const uploadImage = useUploadImage()
  const uploadVideo = useUploadVideo()
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const videoInputRef = React.useRef<HTMLInputElement>(null)
  const posterInputRef = React.useRef<HTMLInputElement>(null)

  /** The merchant's chosen poster frame, if any. Optional — the server derives one otherwise. */
  const [poster, setPoster] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState<'image' | 'video' | null>(null)

  const handleImage = async (file: File) => {
    setBusy('image')
    try {
      const { url } = await uploadImage.mutateAsync(file)
      // Every video column cleared in the same step that sets the image.
      onChange({ mediaType: 'IMAGE', imageUrl: url, videoUrl: '', videoThumbnailUrl: '' })
    } catch (err) {
      toast({
        title: 'Could not upload that image',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const handleVideo = async (file: File) => {
    setBusy('video')
    try {
      const uploaded = await uploadVideo.mutateAsync({ video: file, thumbnail: poster })
      onChange({
        mediaType: 'VIDEO',
        imageUrl: '',
        videoUrl: uploaded.url,
        videoThumbnailUrl: uploaded.thumbnailUrl,
      })
      setPoster(null)
    } catch (err) {
      toast({
        title: 'Could not upload that video',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  const clear = () => onChange(EMPTY_MEDIA)

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      {value.mediaType === 'IMAGE' && value.imageUrl && (
        <div className="flex items-center gap-3">
          <img
            src={value.imageUrl}
            alt=""
            className="h-20 w-28 rounded-md border border-border object-cover"
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ImageIcon className="size-3.5" aria-hidden /> Image
            </span>
            <Button type="button" variant="ghost" size="lg" className="self-start" onClick={clear}>
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        </div>
      )}

      {value.mediaType === 'VIDEO' && value.videoUrl && (
        <div className="flex items-center gap-3">
          {/* The poster frame, not the player: this is what listings show, so
              this is what the merchant should be approving. */}
          <img
            src={value.videoThumbnailUrl}
            alt=""
            className="h-20 w-28 rounded-md border border-border object-cover"
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Video className="size-3.5" aria-hidden /> Video
            </span>
            <span className="text-xs text-muted-foreground">
              Listings show this frame; the video plays on the post&apos;s own page.
            </span>
            <Button type="button" variant="ghost" size="lg" className="self-start" onClick={clear}>
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        </div>
      )}

      {value.mediaType === 'NONE' && (
        <p className="text-xs text-muted-foreground">
          No media. The post&apos;s cards will render without a picture area rather than with an
          empty one.
        </p>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImage(file)
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleVideo(file)
        }}
      />
      <input
        ref={posterInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={busy !== null}
          onClick={() => imageInputRef.current?.click()}
        >
          {busy === 'image' ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
          {value.mediaType === 'IMAGE' ? 'Replace image' : 'Use an image'}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={busy !== null}
          onClick={() => videoInputRef.current?.click()}
        >
          {busy === 'video' ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
          {value.mediaType === 'VIDEO' ? 'Replace video' : 'Use a video'}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => posterInputRef.current?.click()}
        >
          <Upload className="size-4" />
          {poster ? `Poster: ${poster.name}` : 'Choose a video poster (optional)'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        A post shows one thing — choosing an image replaces a video, and the other way round. A
        poster frame is optional; without one, a frame is taken from the video.
      </p>
    </div>
  )
}
