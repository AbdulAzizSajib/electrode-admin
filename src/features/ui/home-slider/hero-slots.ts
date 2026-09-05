import type { BannerPlacement } from '@/lib/api/banners'

/**
 * The homepage hero, described once — as ratios, not fixed pixels.
 *
 * The numbers here used to be measured at a single 1384px content width, and
 * the storefront's hero was built the same way: a 570px right column and a
 * 550px slider height. A merchant who changed their content width therefore
 * changed only the slider's WIDTH, so its box changed SHAPE under artwork cut
 * for the old one — and the guidance here went on promising a size that no
 * longer fitted anything.
 *
 * `Hero.tsx` is now proportional: the right column takes SIDE_COLUMN_FRACTION
 * of the row, each tile carries a fixed aspect ratio, and the slider stretches
 * to the height that column computes to. That makes a slot's SHAPE independent
 * of the content width and only its SIZE dependent on it — which is what lets
 * `recommended` be one size a merchant uploads once, correct at 1140px and at
 * full width alike.
 *
 * This stays ONE constant driving four things that would otherwise drift apart:
 * the size guidance beside each upload control, the aspect ratio of the empty
 * placeholder, the threshold the upload warning checks against, and the
 * "renders at" figure the editor shows for the merchant's own width.
 */

/** The right column's share of the hero row — `lg:w-[43%]` in `Hero.tsx`. */
export const SIDE_COLUMN_FRACTION = 0.43

/** `gap-4` between the hero's columns and between the tiles inside them. */
export const HERO_GAP = 16

/** `container-px` at `lg`, both sides — the row is this much narrower than the site. */
export const CONTENT_PADDING = 64

/** `aspect-43/20` on the promo tile in `Hero.tsx`. The side tiles are square. */
export const PROMO_RATIO = 43 / 20

/**
 * The widest content width a merchant can pick. Artwork guidance is sized from
 * this one so nothing has to be re-uploaded after a width change: a file cut
 * for the widest option is only ever downscaled by a narrower one.
 */
export const WIDEST_CONTENT_WIDTH = 1600

/**
 * What a full-width store is measured at, since its real width is the visitor's
 * viewport and no merchant-facing number exists. A common large desktop.
 */
export const FULL_WIDTH_REFERENCE = 1920

export interface HeroSlot {
  placement: Extract<BannerPlacement, 'HERO_SLIDER' | 'HERO_SIDE' | 'HERO_PROMO'>
  label: string
  description: string
  /**
   * What a merchant should upload. Fixed, because the slot's shape is: 2x the
   * widest rendering, so artwork stays sharp on a high-DPI display.
   */
  recommended: { width: number; height: number }
  /**
   * How many banners this slot renders. The storefront truncates beyond this
   * (`Hero.tsx` slices side tiles to 2 and destructures a single promo), so a
   * banner past the limit is invisible rather than broken — which is exactly
   * why the manager has to surface the overflow instead of hiding it.
   * `null` = unbounded (the slider cycles through as many slides as exist).
   */
  capacity: number | null
}

export interface Size {
  width: number
  height: number
}

/**
 * What the storefront paints for one slot at a given content width, in CSS
 * pixels. The arithmetic is `Hero.tsx`'s layout, read straight off it.
 */
export function renderedSize(
  placement: HeroSlot['placement'],
  contentWidth: number | 'full',
): Size {
  const row = (contentWidth === 'full' ? FULL_WIDTH_REFERENCE : contentWidth) - CONTENT_PADDING
  const sideColumn = row * SIDE_COLUMN_FRACTION
  const sideTile = (sideColumn - HERO_GAP) / 2
  const promoHeight = sideColumn / PROMO_RATIO

  switch (placement) {
    case 'HERO_SIDE':
      return { width: Math.round(sideTile), height: Math.round(sideTile) }
    case 'HERO_PROMO':
      return { width: Math.round(sideColumn), height: Math.round(promoHeight) }
    case 'HERO_SLIDER':
      // The slider takes what the side column leaves and stretches to its
      // height — the two columns share a bottom edge at every content width.
      return {
        width: Math.round(row - sideColumn - HERO_GAP),
        height: Math.round(sideTile + HERO_GAP + promoHeight),
      }
  }
}

/** The largest the storefront will ever paint this slot at a chosen width. */
const widest = (placement: HeroSlot['placement']): Size =>
  renderedSize(placement, WIDEST_CONTENT_WIDTH)

/** 2x, for a high-DPI display. Derived rather than typed out, so it cannot drift. */
const forUpload = (placement: HeroSlot['placement']): Size => {
  const { width, height } = widest(placement)
  return { width: width * 2, height: height * 2 }
}

export const HERO_SLOTS: readonly HeroSlot[] = [
  {
    placement: 'HERO_SLIDER',
    label: 'Hero slider',
    description: 'The large rotating panel on the left of the homepage hero.',
    recommended: forUpload('HERO_SLIDER'),
    capacity: null,
  },
  {
    placement: 'HERO_SIDE',
    label: 'Side tile',
    description: 'The two square tiles at the top right. The layout has exactly two positions.',
    recommended: forUpload('HERO_SIDE'),
    capacity: 2,
  },
  {
    placement: 'HERO_PROMO',
    label: 'Promo tile',
    description: 'The wide tile beneath the side tiles.',
    recommended: forUpload('HERO_PROMO'),
    capacity: 1,
  },
]

/** Mobile artwork is square across every slot — the storefront stacks the hero below `lg`. */
export const MOBILE_ARTWORK = { width: 800, height: 800 }

export const HERO_PLACEMENTS = HERO_SLOTS.map((slot) => slot.placement)

const HERO_PLACEMENT_SET = new Set<string>(HERO_PLACEMENTS)

/**
 * True for a placement the Home Slider manager owns. The generic banner list
 * uses this to exclude them: a hero banner edited from a flat form has no
 * capacity rule applied to it, so the same record would obey different limits
 * depending on which page you opened it from.
 */
export const isHeroPlacement = (placement: BannerPlacement): boolean =>
  HERO_PLACEMENT_SET.has(placement)

export const getHeroSlot = (placement: BannerPlacement): HeroSlot | undefined =>
  HERO_SLOTS.find((slot) => slot.placement === placement)

/** `1720 px × 1290 px` — the exact string the spec requires beside each upload control. */
export const formatSize = (size: Size): string => `${size.width} px × ${size.height} px`

/** `1.33 : 1`, rounded the way a merchant reads it rather than to full float precision. */
export const formatRatio = (size: Size): string => `${(size.width / size.height).toFixed(2)} : 1`

/**
 * How far an uploaded image may stray from its slot's shape before the manager
 * says so. 5% is wide enough that a 1600x1080 export of a 1720x1290 slot passes
 * without nagging, and tight enough to catch a square dropped into the promo.
 */
export const RATIO_TOLERANCE = 0.05

export type DimensionWarning = { kind: 'ratio' | 'undersized'; message: string }

/**
 * Checks an uploaded image against a slot and returns what to warn about, or
 * null when it is fine.
 *
 * Advisory by design — see design.md, "Dimension guidance is advisory". The
 * storefront's `object-cover` already handles off-ratio artwork, so blocking
 * the upload would trade a cosmetic crop for a merchant stuck at 10pm before a
 * sale. This tells them what will happen and lets them decide.
 *
 * Both thresholds are width-independent on purpose: they are the same whichever
 * content width the store runs at, so a merchant is never told a file was fine
 * on Monday and undersized on Tuesday because they widened their site.
 */
export function checkDimensions(slot: HeroSlot, actual: Size): DimensionWarning | null {
  const expectedRatio = slot.recommended.width / slot.recommended.height
  const actualRatio = actual.width / actual.height

  if (Math.abs(actualRatio - expectedRatio) / expectedRatio > RATIO_TOLERANCE) {
    return {
      kind: 'ratio',
      message:
        `This image is ${actual.width}×${actual.height} (${formatRatio(actual)}), but the ` +
        `${slot.label.toLowerCase()} is ${formatRatio(slot.recommended)}. It will be cropped to ` +
        `fill the slot. Recommended: ${formatSize(slot.recommended)}.`,
    }
  }

  const paintedAtWidest = widest(slot.placement).width
  if (actual.width < paintedAtWidest) {
    return {
      kind: 'undersized',
      message:
        `This image is only ${actual.width}px wide but the slot renders at up to ` +
        `${paintedAtWidest}px, so it will look blurry. Recommended: ` +
        `${formatSize(slot.recommended)}.`,
    }
  }

  return null
}

/** Reads a picked file's intrinsic size without uploading it. */
export function readImageDimensions(file: File): Promise<Size> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      // Revoked as soon as the size is known — a form where a merchant swaps
      // artwork repeatedly would otherwise leak an object URL per attempt.
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image'))
    }
    image.src = url
  })
}
