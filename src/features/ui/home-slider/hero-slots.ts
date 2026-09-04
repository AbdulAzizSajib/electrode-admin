import type { BannerPlacement } from '@/lib/api/banners'

/**
 * The homepage hero, described once.
 *
 * Every number here is measured off the storefront's own `Hero.tsx`, which lays
 * out inside `max-w-346` (1384px) with `gap-4` (16px):
 *
 *   - the right column is a fixed 570px
 *   - side tiles are `h-66.25 w-68.75`   -> 265 x 275
 *   - the promo tile is `h-66.25 w-142.5` -> 265 x 570
 *   - so the slider gets 1384 - 570 - 16 = 798 wide,
 *     and 265 + 16 + 265 = 546 tall
 *
 * `recommended` is 2x `rendered` so artwork stays sharp on a high-DPI display.
 *
 * This is deliberately ONE constant driving three things that would otherwise
 * drift apart: the size guidance shown next to each upload control, the aspect
 * ratio of the empty placeholder, and the threshold the upload warning checks
 * against. Three hardcoded copies of `1596` is how the label ends up promising
 * a size nothing validates.
 */
export interface HeroSlot {
  placement: Extract<BannerPlacement, 'HERO_SLIDER' | 'HERO_SIDE' | 'HERO_PROMO'>
  label: string
  description: string
  /** What the storefront actually paints, in CSS pixels. */
  rendered: { width: number; height: number }
  /** What a merchant should upload. */
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

export const HERO_SLOTS: readonly HeroSlot[] = [
  {
    placement: 'HERO_SLIDER',
    label: 'Hero slider',
    description: 'The large rotating panel on the left of the homepage hero.',
    rendered: { width: 798, height: 546 },
    recommended: { width: 1596, height: 1092 },
    capacity: null,
  },
  {
    placement: 'HERO_SIDE',
    label: 'Side tile',
    description: 'The two square tiles at the top right. The layout has exactly two positions.',
    rendered: { width: 275, height: 265 },
    recommended: { width: 550, height: 530 },
    capacity: 2,
  },
  {
    placement: 'HERO_PROMO',
    label: 'Promo tile',
    description: 'The wide tile beneath the side tiles.',
    rendered: { width: 570, height: 265 },
    recommended: { width: 1140, height: 530 },
    capacity: 1,
  },
] as const

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

/** `1596 px × 1092 px` — the exact string the spec requires beside each upload control. */
export const formatSize = (size: { width: number; height: number }): string =>
  `${size.width} px × ${size.height} px`

/** `1.46 : 1`, rounded the way a merchant reads it rather than to full float precision. */
export const formatRatio = (size: { width: number; height: number }): string =>
  `${(size.width / size.height).toFixed(2)} : 1`

/**
 * How far an uploaded image may stray from its slot's shape before the manager
 * says so. 5% is wide enough that a 1600x1080 export of a 1596x1092 slot passes
 * without nagging, and tight enough to catch a square dropped into the promo.
 */
export const RATIO_TOLERANCE = 0.05

export type DimensionWarning = { kind: 'ratio' | 'undersized'; message: string }

/**
 * Checks an uploaded image against a slot and returns what to warn about, or
 * null when it is fine.
 *
 * Advisory by design — see design.md, "Dimension guidance is advisory". The
 * storefront's `object-contain`/`object-cover` already handle off-ratio
 * artwork, so blocking the upload would trade a cosmetic crop for a merchant
 * stuck at 10pm before a sale. This tells them what will happen and lets them
 * decide.
 */
export function checkDimensions(
  slot: HeroSlot,
  actual: { width: number; height: number },
): DimensionWarning | null {
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

  if (actual.width < slot.rendered.width) {
    return {
      kind: 'undersized',
      message:
        `This image is only ${actual.width}px wide but the slot renders at ` +
        `${slot.rendered.width}px, so it will look blurry. Recommended: ` +
        `${formatSize(slot.recommended)}.`,
    }
  }

  return null
}

/** Reads a picked file's intrinsic size without uploading it. */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
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
