import type { BannerPlacement } from '@/lib/api/banners'
import type { HeroVariant } from '@/lib/api/store-settings'

/**
 * The homepage hero, described once — as ratios, not fixed pixels, and now per
 * LAYOUT rather than for the single arrangement that used to be the only one.
 *
 * ── Why ratios ───────────────────────────────────────────────────────────
 *
 * The numbers here used to be measured at a single 1384px content width, and
 * the storefront's hero was built the same way: a 570px right column and a
 * 550px slider height. A merchant who changed their content width therefore
 * changed only the slider's WIDTH, so its box changed SHAPE under artwork cut
 * for the old one — and the guidance here went on promising a size that no
 * longer fitted anything.
 *
 * The storefront's hero components are proportional: a column takes a share of
 * the row, each tile carries a fixed aspect ratio, and the slider stretches to
 * the height that column computes to. That makes a slot's SHAPE independent of
 * the content width and only its SIZE dependent on it — which is what lets
 * `recommended` be one size a merchant uploads once, correct at 1140px and at
 * full width alike.
 *
 * ── Why per layout ───────────────────────────────────────────────────────
 *
 * The hero's arrangement is a merchant setting now. All four arrangements draw
 * on the same three placements, but at different shapes, different counts and
 * — for the two wide ones — a completely different slider ratio. Quoting one
 * arrangement's guidance to a store using another is the main correctness risk
 * of the whole change: a merchant told to export 1720×1290 for a layout that
 * paints 3:1 will produce artwork the storefront crops to a band, and nothing
 * will tell them the advice was wrong.
 *
 * So the geometry is parameterised and the exported signatures changed rather
 * than being overloaded — a call site that still passes no layout should fail
 * to compile, not silently quote the default's numbers.
 *
 * THIS STAYS ONE SOURCE driving four things that would otherwise drift apart:
 * the size guidance beside each upload control, the aspect ratio of the empty
 * placeholder, the threshold the upload warning checks against, and the
 * "renders at" figure the editor shows for the merchant's own width.
 *
 * MUST MATCH `frontend/src/components/home/hero/` EXACTLY, layout by layout.
 * Each component there carries its geometry in a comment block for this file to
 * copy. See openspec/changes/add-hero-section-variants-admin, design.md
 * Decisions 1 and 7.
 */

/** `gap-4` between the hero's columns, and between the tiles inside them. */
export const HERO_GAP = 16

/** `container-px` at `lg`, both sides — the row is this much narrower than the site. */
export const CONTENT_PADDING = 64

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

export type HeroPlacement = Extract<
  BannerPlacement,
  'HERO_SLIDER' | 'HERO_SIDE' | 'HERO_PROMO'
>

export interface Size {
  width: number
  height: number
}

/**
 * One layout's geometry, in the same terms its storefront component uses.
 *
 * `sideColumnFraction` is the share of the row the right-hand column takes in
 * the two split layouts; the wide layouts leave it undefined because they have
 * no side column. `sliderRatio` is likewise only meaningful where the slider
 * has a ratio of its own rather than stretching to a column's height.
 */
interface HeroGeometry {
  /** The share of the row a right-hand column takes, where there is one. */
  sideColumnFraction?: number
  /** The slider's own aspect ratio, where it has one rather than stretching. */
  sliderRatio?: number
  /** How many banners each slot renders. `null` = unbounded. */
  capacity: { HERO_SLIDER: number | null; HERO_SIDE: number; HERO_PROMO: number }
  /** Each rendered tile's aspect ratio. */
  tileRatio: { HERO_SIDE: number; HERO_PROMO: number }
  /** Tiles per row, for the layouts whose tiles sit in a grid. */
  tilesPerRow: number
}

export const HERO_GEOMETRY: Record<HeroVariant, HeroGeometry> = {
  /**
   * Slider left, two square tiles over one 43:20 promo, right column at 43%.
   * UNCHANGED from the constants this module carried before layouts existed —
   * `SIDE_COLUMN_FRACTION = 0.43` and `PROMO_RATIO = 43 / 20`.
   */
  SPLIT_THREE: {
    sideColumnFraction: 0.43,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 2, HERO_PROMO: 1 },
    tileRatio: { HERO_SIDE: 1, HERO_PROMO: 43 / 20 },
    tilesPerRow: 2,
  },

  /**
   * Slider left, ONE square tile filling the same 43% column. Square rather
   * than portrait so the hero stays about as tall as the default — 592px
   * against 579 at a 1440 content width — instead of pushing the first product
   * row most of a screen further down.
   */
  SPLIT_ONE: {
    sideColumnFraction: 0.43,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 1, HERO_PROMO: 0 },
    tileRatio: { HERO_SIDE: 1, HERO_PROMO: 43 / 20 },
    tilesPerRow: 1,
  },

  /** One slider across the whole row at 3:1, and nothing else. */
  FULL_SLIDER: {
    sliderRatio: 3,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 0, HERO_PROMO: 0 },
    tileRatio: { HERO_SIDE: 1, HERO_PROMO: 43 / 20 },
    tilesPerRow: 3,
  },

  /** Full-width 3:1 slider above a row of three 4:3 tiles. */
  SLIDER_STACK: {
    sliderRatio: 3,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 2, HERO_PROMO: 1 },
    tileRatio: { HERO_SIDE: 4 / 3, HERO_PROMO: 4 / 3 },
    tilesPerRow: 3,
  },
}

export interface HeroSlot {
  placement: HeroPlacement
  label: string
  description: string
  /**
   * What a merchant should upload. Fixed per layout, because the slot's shape
   * is: 2x the widest rendering, so artwork stays sharp on a high-DPI display.
   */
  recommended: Size
  /**
   * How many banners this slot renders IN THIS LAYOUT. The storefront truncates
   * beyond this, so a banner past the limit is invisible rather than broken —
   * which is exactly why the manager has to surface the overflow instead of
   * hiding it. `null` = unbounded (the slider cycles through as many slides as
   * exist).
   */
  capacity: number | null
}

/**
 * What the storefront paints for one slot of one layout at a given content
 * width, in CSS pixels. The arithmetic is each hero component's own layout,
 * read straight off it.
 */
export function renderedSize(
  variant: HeroVariant,
  placement: HeroPlacement,
  contentWidth: number | 'full',
): Size {
  const geometry = HERO_GEOMETRY[variant]
  const row = (contentWidth === 'full' ? FULL_WIDTH_REFERENCE : contentWidth) - CONTENT_PADDING

  // The wide layouts: the slider is the whole row and the tiles, where there
  // are any, sit in a grid beneath it.
  if (geometry.sliderRatio !== undefined) {
    if (placement === 'HERO_SLIDER') {
      return { width: Math.round(row), height: Math.round(row / geometry.sliderRatio) }
    }

    const tile = (row - HERO_GAP * (geometry.tilesPerRow - 1)) / geometry.tilesPerRow
    return {
      width: Math.round(tile),
      height: Math.round(tile / geometry.tileRatio[placement]),
    }
  }

  // The split layouts: a side column of a fixed share, and a slider that
  // stretches to whatever height that column computes to.
  const sideColumn = row * (geometry.sideColumnFraction ?? 0)

  if (placement === 'HERO_SIDE') {
    const tile =
      geometry.tilesPerRow === 1
        ? sideColumn
        : (sideColumn - HERO_GAP * (geometry.tilesPerRow - 1)) / geometry.tilesPerRow
    return { width: Math.round(tile), height: Math.round(tile / geometry.tileRatio.HERO_SIDE) }
  }

  if (placement === 'HERO_PROMO') {
    return {
      width: Math.round(sideColumn),
      height: Math.round(sideColumn / geometry.tileRatio.HERO_PROMO),
    }
  }

  // HERO_SLIDER: takes what the side column leaves and stretches to its height,
  // so the two columns share a bottom edge at every content width.
  const sideTileHeight = renderedSize(variant, 'HERO_SIDE', contentWidth).height
  const columnHeight =
    geometry.capacity.HERO_PROMO > 0
      ? sideTileHeight + HERO_GAP + renderedSize(variant, 'HERO_PROMO', contentWidth).height
      : sideTileHeight

  return {
    width: Math.round(row - sideColumn - HERO_GAP),
    height: Math.round(columnHeight),
  }
}

/** The largest the storefront will ever paint this slot at a chosen width. */
const widest = (variant: HeroVariant, placement: HeroPlacement): Size =>
  renderedSize(variant, placement, WIDEST_CONTENT_WIDTH)

/** 2x, for a high-DPI display. Derived rather than typed out, so it cannot drift. */
const forUpload = (variant: HeroVariant, placement: HeroPlacement): Size => {
  const { width, height } = widest(variant, placement)
  return { width: width * 2, height: height * 2 }
}

/** How each slot is described, per layout — the count and the position both move. */
const SLOT_COPY: Record<HeroVariant, Record<HeroPlacement, { label: string; description: string }>> =
  {
    SPLIT_THREE: {
      HERO_SLIDER: {
        label: 'Hero slider',
        description: 'The large rotating panel on the left of the homepage hero.',
      },
      HERO_SIDE: {
        label: 'Side tile',
        description: 'The two square tiles at the top right. The layout has exactly two positions.',
      },
      HERO_PROMO: {
        label: 'Promo tile',
        description: 'The wide tile beneath the side tiles.',
      },
    },
    SPLIT_ONE: {
      HERO_SLIDER: {
        label: 'Hero slider',
        description: 'The large rotating panel on the left of the homepage hero.',
      },
      HERO_SIDE: {
        label: 'Side tile',
        description: 'The single large square image on the right. This layout has one position.',
      },
      HERO_PROMO: {
        label: 'Promo tile',
        description: 'Not shown by this layout.',
      },
    },
    FULL_SLIDER: {
      HERO_SLIDER: {
        label: 'Hero slider',
        description: 'The full-width rotating panel. The only thing this layout shows.',
      },
      HERO_SIDE: { label: 'Side tile', description: 'Not shown by this layout.' },
      HERO_PROMO: { label: 'Promo tile', description: 'Not shown by this layout.' },
    },
    SLIDER_STACK: {
      HERO_SLIDER: {
        label: 'Hero slider',
        description: 'The full-width rotating panel across the top.',
      },
      HERO_SIDE: {
        label: 'Side tile',
        description: 'The first two tiles in the row beneath the slider.',
      },
      HERO_PROMO: {
        label: 'Promo tile',
        description: 'The third tile in the row beneath the slider.',
      },
    },
  }

/** Every hero placement, in the order the storefront lays them out. */
export const HERO_PLACEMENTS: readonly HeroPlacement[] = [
  'HERO_SLIDER',
  'HERO_SIDE',
  'HERO_PROMO',
]

/** The slots a layout actually renders, in order, with its own guidance. */
export function heroSlots(variant: HeroVariant): readonly HeroSlot[] {
  const { capacity } = HERO_GEOMETRY[variant]

  return HERO_PLACEMENTS.filter((placement) => capacity[placement] !== 0).map((placement) => ({
    placement,
    ...SLOT_COPY[variant][placement],
    recommended: forUpload(variant, placement),
    capacity: capacity[placement],
  }))
}

/**
 * The hero placements this layout does NOT render.
 *
 * Their banners are still on file and unmodified, and the storefront renders
 * them again the moment the merchant picks a layout that uses them. The manager
 * lists them in a group of their own rather than hiding them: a merchant whose
 * promo artwork simply vanished from the screen would conclude that changing
 * layout deleted it, and would re-upload everything.
 */
export function unusedSlots(variant: HeroVariant): readonly HeroPlacement[] {
  const { capacity } = HERO_GEOMETRY[variant]
  return HERO_PLACEMENTS.filter((placement) => capacity[placement] === 0)
}

/** Mobile artwork is square across every slot — the storefront stacks the hero below `lg`. */
export const MOBILE_ARTWORK = { width: 800, height: 800 }

const HERO_PLACEMENT_SET = new Set<string>(HERO_PLACEMENTS)

/**
 * True for a placement the Home Slider manager owns. The generic banner list
 * uses this to exclude them: a hero banner edited from a flat form has no
 * capacity rule applied to it, so the same record would obey different limits
 * depending on which page you opened it from.
 *
 * DELIBERATELY NOT PER LAYOUT. A placement the current layout does not render
 * is still the Home Slider page's to manage — that is the whole point of the
 * "not used by this layout" group. Narrowing this would drop those banners into
 * the generic list, which is the one place with no capacity rules at all.
 */
export const isHeroPlacement = (placement: BannerPlacement): boolean =>
  HERO_PLACEMENT_SET.has(placement)

export const getHeroSlot = (
  variant: HeroVariant,
  placement: BannerPlacement,
): HeroSlot | undefined => heroSlots(variant).find((slot) => slot.placement === placement)

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
 * on Monday and undersized on Tuesday because they widened their site. They ARE
 * layout-dependent, which is the point — changing layout can legitimately make
 * artwork the wrong shape, and saying so is this function doing its job.
 */
export function checkDimensions(
  variant: HeroVariant,
  slot: HeroSlot,
  actual: Size,
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

  const paintedAtWidest = widest(variant, slot.placement).width
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
