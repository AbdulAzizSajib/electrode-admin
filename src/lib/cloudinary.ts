/**
 * Cloudinary preview URLs at the size a preview is drawn.
 *
 * Every image preview in the panel used to request the merchant's original
 * upload — a 20-row product table with 32px thumbnails pulled 20 full-size
 * photos. This inserts a delivery transformation right after `/upload/`, so
 * Cloudinary serves a resized, auto-format, auto-quality derivative instead.
 *
 * RENDER-TIME ONLY. Call it where a URL goes into `src`, never on form values
 * or payloads: the URL saved on a record stays the original, so a resized
 * preview can never be written back by a save.
 *
 * `width` is the CSS width the preview is drawn at; the request is 2x for a
 * retina screen. Anything that is not a Cloudinary upload URL — a pasted link
 * to another host, a lookalike host, an empty value — comes back as given, and
 * so does a URL that already carries a transformation.
 *
 * Mirrors the storefront's `lib/cloudinary-url.ts`. The two apps share no
 * package, so this is a deliberate twin rather than an import.
 */

/** `https://res.cloudinary.com/<cloud>/<image|video>/upload/` and everything after it. */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/)(.+)$/

/** A frame Cloudinary renders from a video, under `/video/upload/…jpg`, is an image. */
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif|gif)$/i

/** The first path segment after `/upload/` is a transformation, not a version or folder. */
const TRANSFORMATION_SEGMENT = /^[a-z]{1,3}_[^/]*(,[a-z]{1,3}_[^/]*)*\//

export type ThumbCrop = 'fill' | 'limit'

export function cloudinaryThumb(
  url: string | null | undefined,
  width: number,
  { crop = 'limit' }: { crop?: ThumbCrop } = {},
): string {
  if (!url) return url ?? ''

  const match = CLOUDINARY_UPLOAD.exec(url)
  if (!match) return url

  const [, base, kind, rest] = match
  if (kind === 'video' && !IMAGE_EXTENSION.test(rest)) return url
  if (TRANSFORMATION_SEGMENT.test(rest)) return url

  const size = Math.round(width * 2)
  const transformation =
    crop === 'fill'
      ? `f_auto,q_auto,c_fill,w_${size},h_${size}`
      : `f_auto,q_auto,c_limit,w_${size}`

  return `${base}${transformation}/${rest}`
}
