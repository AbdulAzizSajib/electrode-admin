import * as React from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A small image that degrades to a placeholder rather than a broken one.
 *
 * Three states, one box: a picture, no picture, and a picture that failed to
 * load. The third is why this is a component rather than an `<img>` — a 404
 * renders the browser's broken-image glyph at its own intrinsic size, so a
 * table row with one dead thumbnail is a different height from its neighbours
 * and the column stops lining up. `onError` collapses that back to the same
 * placeholder "no image" already uses, so a missing picture never reflows a
 * layout.
 *
 * Missing images are NORMAL here, not an error: the storefront falls back to a
 * placeholder for products without photography, and order lines are read
 * against a shelf by people who need the row to stay scannable either way.
 *
 * Lifted out of the product form's media sidebar, where it was private, when
 * the order list and order detail needed the same behaviour. Three copies of a
 * broken-image fallback is three chances to get the row height wrong.
 */
export function Thumbnail({
  url,
  alt = '',
  className,
}: {
  url?: string | null
  /**
   * Left empty by default, deliberately. Beside a product name that is already
   * on screen, the image is decoration and a screen reader announcing the name
   * twice is worse than silence. Pass one only where the picture is the only
   * thing identifying the row.
   */
  alt?: string
  className?: string
}) {
  /*
   * WHICH url failed, not whether one did.
   *
   * A boolean would need clearing when the url changes — a variant picker
   * switching colour, say — and clearing it in an effect both lags a render
   * behind and trips the panel's lint rule against setting state inside one.
   * Storing the url makes the reset fall out of the comparison: a new url is
   * not the failed url, so it renders.
   */
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const failed = !!url && failedUrl === url

  if (!url || failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md border border-border bg-muted',
          className,
        )}
        // Decorative, and announced as nothing: "no image" is not information
        // an operator acts on, and repeating it per line is noise.
        aria-hidden="true"
      >
        <ImageIcon className="size-4 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={cn('shrink-0 rounded-md border border-border object-cover', className)}
    />
  )
}
