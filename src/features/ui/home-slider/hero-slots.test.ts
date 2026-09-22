import { describe, expect, it } from 'vitest'
import {
  CONTENT_PADDING,
  HERO_GAP,
  HERO_PLACEMENTS,
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

  it('still recommends the sizes it always did', () => {
    // 2x the widest rendering, at the 1600px content width guidance is sized from.
    expect(getHeroSlot('SPLIT_THREE', 'HERO_SIDE')?.recommended).toEqual({
      width: 644,
      height: 644,
    })
    // row 1536 → column 660 → promo 660 / (43/20) = 307, doubled.
    expect(getHeroSlot('SPLIT_THREE', 'HERO_PROMO')?.recommended).toEqual({
      width: 1320,
      height: 614,
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
    SPLIT_ONE: {
      slots: [
        ['HERO_SLIDER', null],
        ['HERO_SIDE', 1],
      ],
      unused: ['HERO_PROMO'],
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
  it('paint the slider across the whole row at 3:1', () => {
    const { width, height } = renderedSize('FULL_SLIDER', 'HERO_SLIDER', 1440)
    expect(width).toBe(1440 - CONTENT_PADDING)
    expect(width / height).toBeCloseTo(3, 1)
  })

  it('split SLIDER_STACK tiles three across at 4:3', () => {
    const row = 1440 - CONTENT_PADDING
    const { width, height } = renderedSize('SLIDER_STACK', 'HERO_SIDE', 1440)

    expect(width).toBe(Math.round((row - HERO_GAP * 2) / 3))
    expect(width / height).toBeCloseTo(4 / 3, 2)
  })

  it('give the promo tile the same shape as the side tiles in SLIDER_STACK', () => {
    expect(renderedSize('SLIDER_STACK', 'HERO_PROMO', 1440)).toEqual(
      renderedSize('SLIDER_STACK', 'HERO_SIDE', 1440),
    )
  })
})

describe('SPLIT_ONE', () => {
  it('gives its one tile the whole side column, square', () => {
    const sideColumn = (1440 - CONTENT_PADDING) * 0.43
    const { width, height } = renderedSize('SPLIT_ONE', 'HERO_SIDE', 1440)

    expect(width).toBe(Math.round(sideColumn))
    expect(height).toBe(Math.round(sideColumn))
  })

  it('stays close to the default layout in height', () => {
    // The reason the tile is square rather than portrait: a merchant switching
    // between these two should not see the page below the hero jump.
    const split3 = renderedSize('SPLIT_THREE', 'HERO_SLIDER', 1440).height
    const split1 = renderedSize('SPLIT_ONE', 'HERO_SLIDER', 1440).height

    expect(Math.abs(split1 - split3)).toBeLessThan(30)
  })
})

describe('shape is independent of content width', () => {
  it.each(HERO_VARIANT_OPTIONS.map((o) => o.value))('%s keeps every slot ratio', (variant) => {
    for (const slot of heroSlots(variant)) {
      const ratios = WIDTHS.map((w) => {
        const { width, height } = renderedSize(variant, slot.placement, w)
        return width / height
      })

      // Every width yields the same shape — only the size moves. Rounding to
      // whole pixels is the only source of drift, hence the tolerance.
      for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0], 1)
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
