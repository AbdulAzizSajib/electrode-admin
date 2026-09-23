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
 * ── Why one box ─────────────────────────────────────────────────────────
 *
 * EVERY LAYOUT PAINTS THE SAME OUTER BOX. Only the arrangement inside differs.
 * The reference is SPLIT_THREE, whose height is its side column — two square
 * tiles over a 43:20 promo, 0.415 x row + 8px — and the other two layouts fit
 * inside a box of that shape rather than choosing their own: FULL_SLIDER fills
 * it with one panel, SLIDER_STACK puts a row of 43:20 tiles along the bottom
 * and lets its slider take what is left, and SPLIT_TALL stands one 19:24 tile
 * in the right third — a third of the row at 19:24 is the box's height exactly.
 *
 * Before this the three layouts were 579, 459 and 811px tall at a 1440 content
 * width. A merchant trying layouts saw the entire page below the hero jump by
 * up to 350px on every click, which reads as the layouts being different
 * PAGES rather than different arrangements of one hero.
 *
 * `HERO_RATIO` (19:8) is that box. It is the column's ratio to within 4px at
 * every content width from 1140 to 1920 — the 8px gap keeps it from being an
 * exact ratio, and CSS `aspect-ratio` cannot express "+8px". The test asserts
 * the three heights agree within that.
 *
 * ── Why stated upload sizes ─────────────────────────────────────
 *
 * The SHAPES here are derived; the SIZE each slot asks a merchant to export is
 * not. `recommended` was 2x the widest rendering, which is exactly right and
 * unusable: it produced 1720x1290, 644x644, 1320x614 and 1002x752. A merchant
 * reading "644 px × 644 px" cannot tell whether they misread it, and types it
 * into an image editor wrong. So each layout STATES a round size per slot in
 * `HERO_GEOMETRY[...].upload`.
 *
 * Two invariants replace what the derivation guaranteed for free, and
 * `hero-slots.test.ts` enforces both for every slot of every layout:
 *
 *   1. WHOLE PIXELS on both axes — no merchant can export a 614.3px image.
 *   2. Within `RATIO_TOLERANCE` of the slot's real ratio. If a stated size
 *      drifted past that, artwork cut to the size THIS PANEL ASKED FOR would
 *      trip the panel's own crop warning — the page calling its own advice
 *      wrong, which is worse than no advice.
 *
 * The undersized check still compares against `widest()`, not against the
 * stated size, so lowering a stated figure below what the slot paints is caught
 * as blur rather than passing silently.
 *
 * THIS STAYS ONE SOURCE driving four things that would otherwise drift apart:
 * the size guidance beside each upload control, the aspect ratio of the empty
 * placeholder, the threshold the upload warning checks against, and the
 * "renders at" figure the editor shows for the merchant's own width.
 *
 * MUST MATCH `nextjs/src/components/home/hero/` EXACTLY, layout by layout.
 * (The openspec docs call that directory `frontend/`; the workspace is `nextjs/`.)
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

/**
 * The outer box every layout paints, as width : height. See "Why one box" in
 * the header. MUST MATCH `lg:aspect-19/8` on the storefront's HeroFullSlider
 * and HeroSliderStack — SPLIT_THREE does not declare it because its box IS
 * this ratio, derived from its tiles.
 */
export const HERO_RATIO = 19 / 8

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
 * the split layout; the wide layouts leave it undefined because they have no
 * side column. `stacked` marks those wide layouts: the slider spans the row and
 * any tiles sit in a grid beneath it, all inside the shared `HERO_RATIO` box.
 *
 * NO LAYOUT HAS A SLIDER RATIO OF ITS OWN. In every layout the slider stretches
 * to whatever the box leaves it — beside the side column in SPLIT_THREE,
 * above the tile row in SLIDER_STACK, the whole box in FULL_SLIDER. That is
 * what keeps the three heights equal.
 */
interface HeroGeometry {
  /** The share of the row a right-hand column takes, where there is one. */
  sideColumnFraction?: number
  /** The wide arrangement: slider across the row, tiles in a grid beneath. */
  stacked?: true
  /** How many banners each slot renders. `null` = unbounded. */
  capacity: { HERO_SLIDER: number | null; HERO_SIDE: number; HERO_PROMO: number }
  /** Each rendered tile's aspect ratio. */
  tileRatio: { HERO_SIDE: number; HERO_PROMO: number }
  /** Tiles per row, for the layouts whose tiles sit in a grid. */
  tilesPerRow: number
  /**
   * What this layout tells a merchant to export, per slot, in whole pixels.
   *
   * STATED, NOT DERIVED, and that is the whole point of it — see the
   * "Why stated upload sizes" block in this module's header. Every pair here
   * must be a WHOLE NUMBER on both axes and must sit within `RATIO_TOLERANCE`
   * of the slot's real ratio, or artwork cut to the size this panel asked for
   * would draw the panel's own crop warning. `hero-slots.test.ts` asserts both,
   * for every slot of every layout.
   */
  upload: { HERO_SLIDER: Size; HERO_SIDE: Size; HERO_PROMO: Size }
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
    // 4:3, 1:1 and 43:20 exactly. The promo is 1720x800 rather than a rounder
    // 1700x790 because 43:20 divides 1720 cleanly and nothing else near that
    // size does.
    upload: {
      HERO_SLIDER: { width: 1800, height: 1350 },
      HERO_SIDE: { width: 1400, height: 1400 },
      HERO_PROMO: { width: 1720, height: 800 },
    },
  },

  /** One slider filling the whole 19:8 box, and nothing else. */
  FULL_SLIDER: {
    stacked: true,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 0, HERO_PROMO: 0 },
    tileRatio: { HERO_SIDE: 1, HERO_PROMO: 43 / 20 },
    tilesPerRow: 3,
    // 2850x1200 is 19:8 exactly, and comfortably over the 1536px this paints
    // at its widest. The two unrendered slots keep SPLIT_THREE's sizes so the
    // "not used by this layout" group has a figure to show.
    upload: {
      HERO_SLIDER: { width: 2850, height: 1200 },
      HERO_SIDE: { width: 1400, height: 1400 },
      HERO_PROMO: { width: 1720, height: 800 },
    },
  },

  /**
   * A row of three 43:20 tiles along the bottom of the 19:8 box, and a slider
   * stretching to fill what is above them.
   *
   * The tiles are 43:20 — the same shape as SPLIT_THREE's promo tile — so a
   * merchant's promo artwork renders uncropped in both layouts. Fitting a
   * whole extra row into the shared box is what makes the slider short here:
   * 1376x355 at a 1440 content width, about 3.9:1.
   */
  SLIDER_STACK: {
    stacked: true,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 2, HERO_PROMO: 1 },
    tileRatio: { HERO_SIDE: 43 / 20, HERO_PROMO: 43 / 20 },
    tilesPerRow: 3,
    // 3100x800 is 3.875:1, within 0.3% of the 3.86:1 the slider paints at its
    // widest. All three tiles are one shape and ask for one file — the same
    // file as SPLIT_THREE's promo.
    upload: {
      HERO_SLIDER: { width: 3100, height: 800 },
      HERO_SIDE: { width: 1720, height: 800 },
      HERO_PROMO: { width: 1720, height: 800 },
    },
  },

  /**
   * Slider left, one TALL tile filling the right third.
   *
   * The tile is a third of the row at 19:24 — chosen because (row / 3) x
   * (24 / 19) is row x 8 / 19, the shared box's height exactly. So this is the
   * one layout whose height matches SPLIT_THREE's to the pixel rather than to
   * within a rounding gap. The slider stretches to it, as in every split
   * layout, and is about 1.56:1 as a result.
   */
  SPLIT_TALL: {
    sideColumnFraction: 1 / 3,
    capacity: { HERO_SLIDER: null, HERO_SIDE: 0, HERO_PROMO: 1 },
    tileRatio: { HERO_SIDE: 19 / 24, HERO_PROMO: 19 / 24 },
    tilesPerRow: 1,
    // 950x1200 is 19:24 exactly; 1560x1000 is within 0.1% of the 1.559:1 the
    // slider paints at its widest. HERO_SIDE is unrendered here and keeps
    // SPLIT_THREE's size so the "not used by this layout" group has a figure.
    upload: {
      HERO_SLIDER: { width: 1560, height: 1000 },
      HERO_SIDE: { width: 1400, height: 1400 },
      HERO_PROMO: { width: 950, height: 1200 },
    },
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

  // The wide layouts: the box is `HERO_RATIO`, the tiles (where there are
  // any) sit in a grid along its bottom, and the slider takes what is above
  // them — the whole box when there are none.
  if (geometry.stacked) {
    const box = row / HERO_RATIO
    const tile = (row - HERO_GAP * (geometry.tilesPerRow - 1)) / geometry.tilesPerRow

    if (placement === 'HERO_SLIDER') {
      const hasTiles = geometry.capacity.HERO_SIDE + geometry.capacity.HERO_PROMO > 0
      const tileRow = hasTiles ? tile / geometry.tileRatio.HERO_SIDE + HERO_GAP : 0
      return { width: Math.round(row), height: Math.round(box - tileRow) }
    }

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
  // so the two columns share a bottom edge at every content width. The column
  // is whichever tiles this layout renders, stacked with a gap between — both
  // in SPLIT_THREE, the promo alone in SPLIT_TALL.
  const parts = (['HERO_SIDE', 'HERO_PROMO'] as const)
    .filter((p) => geometry.capacity[p] > 0)
    .map((p) => renderedSize(variant, p, contentWidth).height)
  const columnHeight = parts.reduce((sum, h) => sum + h, 0) + HERO_GAP * (parts.length - 1)

  return {
    width: Math.round(row - sideColumn - HERO_GAP),
    height: Math.round(columnHeight),
  }
}

/** The largest the storefront will ever paint this slot at a chosen width. */
const widest = (variant: HeroVariant, placement: HeroPlacement): Size =>
  renderedSize(variant, placement, WIDEST_CONTENT_WIDTH)

/**
 * What the panel tells a merchant to export for this slot of this layout.
 *
 * READ FROM `HERO_GEOMETRY[variant].upload`, not computed. It used to be 2x
 * `widest()`, which was correct to the pixel and useless to a human: it asked
 * for 1720x1290, 644x644, 1320x614 and 1002x752, none of which a merchant can
 * hold in their head or set up in an image editor without reading it twice. A
 * stated size is a round one, and `hero-slots.test.ts` holds it to the two
 * things the derivation gave for free — whole numbers, and the slot's real
 * ratio to within `RATIO_TOLERANCE`.
 */
const forUpload = (variant: HeroVariant, placement: HeroPlacement): Size =>
  HERO_GEOMETRY[variant].upload[placement]

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
    SPLIT_TALL: {
      HERO_SLIDER: {
        label: 'Hero slider',
        description: 'The wide rotating panel on the left, two thirds of the hero.',
      },
      HERO_SIDE: { label: 'Side tile', description: 'Not shown by this layout.' },
      HERO_PROMO: {
        label: 'Promo tile',
        description: 'The tall tile filling the right third. This layout has one position.',
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
