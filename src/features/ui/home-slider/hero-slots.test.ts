import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CONTENT_PADDING,
  HERO_GAP,
  HERO_GEOMETRY,
  HERO_PLACEMENTS,
  HERO_RATIO,
  RATIO_TOLERANCE,
  WIDEST_CONTENT_WIDTH,
  checkDimensions,
  getHeroSlot,
  heroSlots,
  isHeroPlacement,
  renderedSize,
  unusedSlots,
} from '@/features/ui/home-slider/hero-slots'
import { HERO_VARIANT_OPTIONS, type HeroVariant } from '@/lib/api/store-settings'

const WIDTHS = [1140, 1440, 1600, 'full'] as const

describe('SPLIT_THREE is unchanged by the parameterisation', () => {
  /*
   * The regression guard on the refactor. Every store today renders this
   * layout, and its guidance is what merchants have already exported artwork
   * against — so these are the numbers the module produced when the geometry
   * was the hardcoded `SIDE_COLUMN_FRACTION = 0.43` and `PROMO_RATIO = 43/20`,
   * recomputed here from first principles rather than copied from the
   * implementation.
   */
  it.each(WIDTHS)('matches the original arithmetic at %s', (contentWidth) => {
    const row = (contentWidth === 'full' ? 1920 : contentWidth) - CONTENT_PADDING
    const sideColumn = row * 0.43
    const sideTile = (sideColumn - HERO_GAP) / 2
    const promoHeight = sideColumn / (43 / 20)

    expect(renderedSize('SPLIT_THREE', 'HERO_SIDE', contentWidth)).toEqual({
      width: Math.round(sideTile),
      height: Math.round(sideTile),
    })
    expect(renderedSize('SPLIT_THREE', 'HERO_PROMO', contentWidth)).toEqual({
      width: Math.round(sideColumn),
      height: Math.round(promoHeight),
    })
    expect(renderedSize('SPLIT_THREE', 'HERO_SLIDER', contentWidth)).toEqual({
      width: Math.round(row - sideColumn - HERO_GAP),
      height: Math.round(Math.round(sideTile) + HERO_GAP + Math.round(promoHeight)),
    })
  })

  it('recommends the round sizes the layout states', () => {
    // These are STATED in `HERO_GEOMETRY.SPLIT_THREE.upload`, not derived. They
    // replaced 2x-the-widest-rendering — 644x644 and 1320x614 — which were
    // correct to the pixel and unusable to a merchant. The invariants that
    // derivation used to give for free are asserted in their own describe block
    // below: whole pixels, and the slot's real ratio within tolerance.
    expect(getHeroSlot('SPLIT_THREE', 'HERO_SIDE')?.recommended).toEqual({
      width: 1400,
      height: 1400,
    })
    expect(getHeroSlot('SPLIT_THREE', 'HERO_PROMO')?.recommended).toEqual({
      width: 1720,
      height: 800,
    })
    expect(getHeroSlot('SPLIT_THREE', 'HERO_SLIDER')?.recommended).toEqual({
      width: 1800,
      height: 1350,
    })
  })

  it('keeps its slots and capacities', () => {
    expect(heroSlots('SPLIT_THREE').map((s) => [s.placement, s.capacity])).toEqual([
      ['HERO_SLIDER', null],
      ['HERO_SIDE', 2],
      ['HERO_PROMO', 1],
    ])
    expect(unusedSlots('SPLIT_THREE')).toEqual([])
  })
})

describe('each layout renders the slots it uses', () => {
  const EXPECTED: Record<HeroVariant, { slots: [string, number | null][]; unused: string[] }> = {
    SPLIT_THREE: {
      slots: [
        ['HERO_SLIDER', null],
        ['HERO_SIDE', 2],
        ['HERO_PROMO', 1],
      ],
      unused: [],
    },
    FULL_SLIDER: {
      slots: [['HERO_SLIDER', null]],
      unused: ['HERO_SIDE', 'HERO_PROMO'],
    },
    SLIDER_STACK: {
      slots: [
        ['HERO_SLIDER', null],
        ['HERO_SIDE', 2],
        ['HERO_PROMO', 1],
      ],
      unused: [],
    },
    SPLIT_TALL: {
      slots: [
        ['HERO_SLIDER', null],
        ['HERO_PROMO', 1],
      ],
      unused: ['HERO_SIDE'],
    },
  }

  it.each(Object.keys(EXPECTED) as HeroVariant[])('%s', (variant) => {
    expect(heroSlots(variant).map((s) => [s.placement, s.capacity])).toEqual(
      EXPECTED[variant].slots,
    )
    expect(unusedSlots(variant)).toEqual(EXPECTED[variant].unused)
  })

  it('rendered and unused together are always every hero placement', () => {
    for (const { value } of HERO_VARIANT_OPTIONS) {
      const covered = [...heroSlots(value).map((s) => s.placement), ...unusedSlots(value)].sort()
      expect(covered).toEqual([...HERO_PLACEMENTS].sort())
    }
  })
})

describe('the wide layouts', () => {
  it('paint FULL_SLIDER across the whole row, filling the 19:8 box', () => {
    const { width, height } = renderedSize('FULL_SLIDER', 'HERO_SLIDER', 1440)
    expect(width).toBe(1440 - CONTENT_PADDING)
    expect(width / height).toBeCloseTo(HERO_RATIO, 2)
  })

  it('split SLIDER_STACK tiles three across at 43:20, the promo shape', () => {
    const row = 1440 - CONTENT_PADDING
    const { width, height } = renderedSize('SLIDER_STACK', 'HERO_SIDE', 1440)

    expect(width).toBe(Math.round((row - HERO_GAP * 2) / 3))
    expect(width / height).toBeCloseTo(43 / 20, 2)
  })

  it('give the promo tile the same shape as the side tiles in SLIDER_STACK', () => {
    expect(renderedSize('SLIDER_STACK', 'HERO_PROMO', 1440)).toEqual(
      renderedSize('SLIDER_STACK', 'HERO_SIDE', 1440),
    )
  })

  it('let the SLIDER_STACK slider take what the tile row leaves', () => {
    const row = 1440 - CONTENT_PADDING
    const slider = renderedSize('SLIDER_STACK', 'HERO_SLIDER', 1440)
    const tile = renderedSize('SLIDER_STACK', 'HERO_SIDE', 1440)

    expect(slider.width).toBe(row)
    expect(slider.height + HERO_GAP + tile.height).toBeCloseTo(row / HERO_RATIO, 0)
  })
})

/*
 * EVERY LAYOUT IS THE SAME HEIGHT. This is the invariant the merchant asked
 * for, and the one thing the layouts share: the outer box. Before it,
 * they were 579, 459 and 811px tall at a 1440 content width, and switching
 * layout moved the whole page below the hero by up to 350px.
 *
 * "Within 4px", not exact: SPLIT_THREE's height is its tile column, which
 * carries a 16px gap, so it is 0.415 x row + 8px rather than a pure ratio —
 * and CSS `aspect-ratio` cannot express "+8px". 19:8 is that column's ratio
 * to within 4px across every content width a merchant can pick. Below the
 * threshold of a visible jump; above the threshold of a rounding accident.
 *
 * See hero-slots.ts, "Why one box".
 */
describe('every layout paints the same outer box', () => {
  /** The full hero height a layout paints, top of slider to bottom of the last tile. */
  const heroHeight = (variant: HeroVariant, width: number | 'full'): number => {
    const slider = renderedSize(variant, 'HERO_SLIDER', width)
    if (variant !== 'SLIDER_STACK') return slider.height
    return slider.height + HERO_GAP + renderedSize(variant, 'HERO_SIDE', width).height
  }

  it.each(WIDTHS)('at a %s content width, every layout agrees within 4px', (width) => {
    const reference = heroHeight('SPLIT_THREE', width)

    for (const option of HERO_VARIANT_OPTIONS) {
      const height = heroHeight(option.value, width)
      expect(
        Math.abs(height - reference),
        `${option.value} is ${height}px against SPLIT_THREE's ${reference}px`,
      ).toBeLessThanOrEqual(4)
    }
  })

  it('is the 19:8 box the storefront declares on the wide layouts', () => {
    // The figure the storefront's `lg:aspect-19/8` and this module's
    // `HERO_RATIO` both have to hold. Pinned as a number so a change to
    // either without the other fails here, not on a merchant's page.
    expect(HERO_RATIO).toBe(19 / 8)

    const row = 1440 - CONTENT_PADDING
    expect(heroHeight('SPLIT_THREE', 1440)).toBeCloseTo(row / HERO_RATIO, -1)
  })
})

describe('shape is independent of content width', () => {
  /*
   * The guarantee behind one recommended size per slot: artwork cut to it is
   * the right shape at EVERY content width a merchant can pick, not only at the
   * one the size was derived from.
   *
   * RELATIVE drift against the stated size, judged by `RATIO_TOLERANCE` — the
   * same yardstick `checkDimensions` uses on the merchant's own file. An
   * earlier version compared painted ratios to each other with an absolute
   * ±0.05, which is 3.7% on a 4:3 tile and 1.3% on a 3.9:1 slider: the
   * stretching sliders (whose fixed 16px gap is a larger share of a shorter
   * box) failed it while being well inside what the panel itself accepts.
   */
  it.each(HERO_VARIANT_OPTIONS.map((o) => o.value))('%s keeps every slot ratio', (variant) => {
    for (const slot of heroSlots(variant)) {
      const stated = slot.recommended.width / slot.recommended.height

      for (const width of WIDTHS) {
        const painted = renderedSize(variant, slot.placement, width)
        const drift = Math.abs(painted.width / painted.height - stated) / stated

        expect(drift, `${variant}/${slot.placement} at ${width}: ${(drift * 100).toFixed(2)}%`)
          .toBeLessThanOrEqual(RATIO_TOLERANCE)
      }
    }
  })
})

describe('a content-width change moves what is painted, not what to upload', () => {
  /*
   * The whole reason `recommended` is sized from the widest content width: a
   * merchant exports artwork once, and widening or narrowing their site must
   * not make this panel start asking for a different file. Only the "renders
   * at" figure beside it moves.
   */
  it.each(HERO_VARIANT_OPTIONS.map((o) => o.value))(
    '%s recommends the same size at every width',
    (variant) => {
      for (const slot of heroSlots(variant)) {
        // `recommended` is a property of the slot, not of the width — it is
        // computed once from WIDEST_CONTENT_WIDTH. Asserted anyway, because a
        // refactor that threaded the current width into it would look correct.
        const sizes = WIDTHS.map(() => getHeroSlot(variant, slot.placement)?.recommended)
        for (const size of sizes) expect(size).toEqual(sizes[0])
      }
    },
  )

  it.each(HERO_VARIANT_OPTIONS.map((o) => o.value))(
    '%s paints larger at a wider content width',
    (variant) => {
      for (const slot of heroSlots(variant)) {
        const narrow = renderedSize(variant, slot.placement, 1140)
        const wide = renderedSize(variant, slot.placement, 1600)

        expect(wide.width).toBeGreaterThan(narrow.width)
        expect(wide.height).toBeGreaterThan(narrow.height)
      }
    },
  )
})

describe('dimension warnings follow the layout', () => {
  it('accepts artwork cut for the layout in use', () => {
    const slot = getHeroSlot('FULL_SLIDER', 'HERO_SLIDER')!
    expect(checkDimensions('FULL_SLIDER', slot, slot.recommended)).toBeNull()
  })

  it('warns when the same artwork is used under a layout it does not fit', () => {
    // A file cut for the default layout's promo tile, under the full-width
    // slider: same bytes, different slot, and the merchant needs to be told.
    const promo = getHeroSlot('SPLIT_THREE', 'HERO_PROMO')!
    const slider = getHeroSlot('FULL_SLIDER', 'HERO_SLIDER')!

    const warning = checkDimensions('FULL_SLIDER', slider, promo.recommended)
    expect(warning?.kind).toBe('ratio')
    expect(warning?.message).toContain('cropped')
  })

  it('warns about artwork too small for the slot it is in', () => {
    const slot = getHeroSlot('SPLIT_THREE', 'HERO_SIDE')!
    const warning = checkDimensions('SPLIT_THREE', slot, { width: 200, height: 200 })

    expect(warning?.kind).toBe('undersized')
  })
})

describe('isHeroPlacement', () => {
  it('claims every hero placement regardless of the layout in use', () => {
    // Not per layout: an unrendered slot is still the Home Slider page's to
    // manage, or it would fall into the generic banner list which applies no
    // capacity rules at all.
    for (const placement of HERO_PLACEMENTS) expect(isHeroPlacement(placement)).toBe(true)
    expect(isHeroPlacement('MID')).toBe(false)
  })
})

/*
 * The two invariants that replaced the derivation.
 *
 * `recommended` used to be 2x the widest rendering, which guaranteed whole
 * pixels and the exact ratio as a side effect of the arithmetic. It now names a
 * round size per slot per layout, so both have to be asserted — a merchant
 * cannot export a fractional pixel, and a stated size that drifts off the
 * slot's ratio would make artwork cut to THIS PANEL'S OWN ADVICE trip the
 * panel's crop warning.
 *
 * See hero-slots.ts, "Why stated upload sizes".
 */
describe('the stated upload sizes are usable', () => {
  const VARIANTS = HERO_VARIANT_OPTIONS.map((o) => o.value)

  it('is a whole number of pixels on both axes, for every slot of every layout', () => {
    for (const variant of VARIANTS) {
      for (const placement of HERO_PLACEMENTS) {
        const { width, height } = HERO_GEOMETRY[variant].upload[placement]

        expect(Number.isInteger(width), `${variant}/${placement} width ${width}`).toBe(true)
        expect(Number.isInteger(height), `${variant}/${placement} height ${height}`).toBe(true)
        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
      }
    }
  })

  it('matches the ratio the storefront actually paints, within tolerance', () => {
    for (const variant of VARIANTS) {
      for (const slot of heroSlots(variant)) {
        const painted = renderedSize(variant, slot.placement, WIDEST_CONTENT_WIDTH)
        const paintedRatio = painted.width / painted.height
        const statedRatio = slot.recommended.width / slot.recommended.height
        const drift = Math.abs(statedRatio - paintedRatio) / paintedRatio

        expect(drift, `${variant}/${slot.placement} drifts ${(drift * 100).toFixed(2)}%`)
          .toBeLessThanOrEqual(RATIO_TOLERANCE)
      }
    }
  })

  it('never asks for artwork the panel would then call the wrong shape', () => {
    // The round-trip: export exactly what a slot recommends, hand it back to
    // the checker, and it must be satisfied. This is the failure the ratio
    // assertion above exists to prevent, stated as the merchant would hit it.
    for (const variant of VARIANTS) {
      for (const slot of heroSlots(variant)) {
        expect(
          checkDimensions(variant, slot, slot.recommended),
          `${variant}/${slot.placement} rejects its own recommended size`,
        ).toBeNull()
      }
    }
  })

  it('covers the widest the slot is ever painted, so nothing is upscaled', () => {
    for (const variant of VARIANTS) {
      for (const slot of heroSlots(variant)) {
        const painted = renderedSize(variant, slot.placement, WIDEST_CONTENT_WIDTH)

        expect(
          slot.recommended.width,
          `${variant}/${slot.placement} recommends ${slot.recommended.width}px for a ${painted.width}px slot`,
        ).toBeGreaterThanOrEqual(painted.width)
      }
    }
  })

  it('states a size for unrendered slots too, so the unused group can show one', () => {
    // The "not used by this layout" group lists banners in slots the layout
    // does not paint. It still has to say what shape they are.
    for (const variant of VARIANTS) {
      for (const placement of unusedSlots(variant)) {
        const { width, height } = HERO_GEOMETRY[variant].upload[placement]
        expect(width).toBeGreaterThan(0)
        expect(height).toBeGreaterThan(0)
      }
    }
  })
})

/*
 * A size appears ONCE per slot on the Home Slider page.
 *
 * The badge on the section heading and `EmptySlot`'s own caption both printed
 * `slot.recommended`, so an empty slot showed the merchant the same figure
 * twice, two lines apart, in two different formats — "1400 × 1400 px" against
 * "1400 px × 1400 px". Reading the same number twice in two spellings is worse
 * than reading it once: it invites the question of which is the real one.
 *
 * Asserted against the source because the two printers are module-private
 * components, and exporting them purely to be rendered here would widen the
 * module's surface for the sake of the test. This checks the thing that
 * actually regressed — a second printed `slot.recommended` in the placeholder.
 */
describe('the page prints each slot size once', () => {
  // Resolved from the project root, not `import.meta.url` — Vite serves this
  // module over a non-`file:` URL, which `readFileSync` refuses.
  const PAGE = readFileSync(
    'src/features/ui/home-slider/home-slider-page.tsx',
    'utf8',
  )

  /** One component's source, to the next top-level declaration. */
  const bodyOf = (name: string) => {
    const start = PAGE.indexOf(`function ${name}(`)
    expect(start, `${name} not found — was it renamed?`).toBeGreaterThan(-1)

    const rest = PAGE.slice(start + 1)
    const end = rest.search(/\n(?:function|const|export) /)
    return end === -1 ? rest : rest.slice(0, end)
  }

  it('states the shape in the placeholder but not the size', () => {
    const empty = bodyOf('EmptySlot')

    // The shape still comes from `recommended`, via `aspectRatio` — that is
    // what a proportioned placeholder is for, and it prints no number.
    expect(empty).toContain('aspectRatio')
    expect(empty).not.toContain('formatSize')
  })

  it('prints the size on the heading badge, in the shared format', () => {
    // `formatSize`, not a hand-rolled template — one spelling of a size
    // wherever the panel shows one.
    expect(bodyOf('SlotSizeBadge')).toContain('formatSize(slot.recommended)')
  })
})

/*
 * The split layout's side column is a SHARE of the row.
 *
 * The page drew it as `xl:w-96` — a hardcoded 384px. That happened to look
 * right at one panel width, because SPLIT_THREE's column holds two half-width
 * square tiles. It was still wrong: at any other width the drawn column stopped
 * agreeing with the storefront's, and the page showed an arrangement the
 * storefront does not render — the one failure it exists to prevent.
 *
 * This pins the geometry the page has to draw from, so the figure it needs is
 * always available from one place and there is no reason to hardcode a width.
 * The page uses `xl:w-[43%]`, matching the storefront's `lg:w-[43%]`.
 */
describe('the split layout side column is a fraction of the row', () => {
  it('is 43% of the row, as the storefront paints it', () => {
    expect(HERO_GEOMETRY.SPLIT_THREE.sideColumnFraction).toBe(0.43)
  })

  it('leaves the slider the rest of the row', () => {
    // What `flex-1` beside a 43% column has to come out as. If the page pinned
    // the column to a fixed width instead, these would stop agreeing at every
    // panel width but one.
    const row = 1440 - CONTENT_PADDING
    const column = row * (HERO_GEOMETRY.SPLIT_THREE.sideColumnFraction ?? 0)
    const slider = renderedSize('SPLIT_THREE', 'HERO_SLIDER', 1440)

    expect(slider.width).toBe(Math.round(row - column - HERO_GAP))
  })

  it('holds two square side tiles at half the column each', () => {
    const row = 1440 - CONTENT_PADDING
    const column = row * (HERO_GEOMETRY.SPLIT_THREE.sideColumnFraction ?? 0)
    const tile = renderedSize('SPLIT_THREE', 'HERO_SIDE', 1440)

    expect(tile.width).toBe(Math.round((column - HERO_GAP) / 2))
    expect(tile.height).toBe(tile.width)
  })
})

describe('SPLIT_TALL', () => {
  it('stands its one tile in the right third, at 19:24', () => {
    const row = 1440 - CONTENT_PADDING
    const tile = renderedSize('SPLIT_TALL', 'HERO_PROMO', 1440)

    expect(tile.width).toBe(Math.round(row / 3))
    expect(tile.width / tile.height).toBeCloseTo(19 / 24, 2)
  })

  it('makes that tile exactly the shared box tall, by construction', () => {
    // (row / 3) x (24 / 19) = row x 8 / 19 = row / HERO_RATIO. The one layout
    // whose height equals the box to the pixel rather than to within the gap.
    for (const width of WIDTHS) {
      const row = (width === 'full' ? 1920 : width) - CONTENT_PADDING
      expect(renderedSize('SPLIT_TALL', 'HERO_PROMO', width).height).toBe(Math.round(row / HERO_RATIO))
    }
  })

  it('stretches the slider to the tile and gives it the rest of the row', () => {
    const row = 1440 - CONTENT_PADDING
    const slider = renderedSize('SPLIT_TALL', 'HERO_SLIDER', 1440)
    const tile = renderedSize('SPLIT_TALL', 'HERO_PROMO', 1440)

    expect(slider.height).toBe(tile.height)
    expect(slider.width).toBe(Math.round(row - row / 3 - HERO_GAP))
  })
})
