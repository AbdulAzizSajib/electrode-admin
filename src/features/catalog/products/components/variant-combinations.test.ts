import { describe, expect, it } from 'vitest'
import {
  combinationKey,
  combinationsOf,
  describeCarryOverLoss,
  rebuildCombinations,
  type ExistingVariant,
  type SelectedAttribute,
} from '@/features/catalog/products/components/variant-combinations'

/**
 * Tasks 9.1–9.3 — the matcher that decides whether a merchant keeps their stock.
 *
 * 9.3 is the reason this change exists: authoring options on an existing
 * product used to regenerate its variants and silently reset four of them to
 * zero stock. Every case below is a way that could happen again.
 */

const attribute = (
  attributeId: string,
  name: string,
  values: [string, string][],
): SelectedAttribute => ({
  attributeId,
  name,
  valueIds: values.map(([id]) => id),
  labelById: Object.fromEntries(values),
})

const colour = attribute('a-colour', 'Colour', [
  ['v-red', 'Red'],
  ['v-green', 'Green'],
])
const size = attribute('a-size', 'Size', [
  ['v-s', 'S'],
  ['v-m', 'M'],
])

/** Keys are minted in call order, which is enough to tell new rows apart. */
const keyFactory = () => {
  let n = 0
  return () => `__new_${(n += 1)}`
}

const defaults = () => ({ offerPrice: 100, skuPrefix: 'prod', nextKey: keyFactory() })

const existing = (
  over: Partial<ExistingVariant> & Pick<ExistingVariant, 'variantKey'>,
): ExistingVariant => ({
  id: over.variantKey,
  name: '',
  sku: '',
  offerPrice: 0,
  stockQuantity: 0,
  valueIds: [],
  ...over,
})

describe('combinationKey', () => {
  it('does not depend on the order the values are listed in', () => {
    // The reference panel's key is order-sensitive and only works by accident of
    // how JS orders integer-like keys. Reordering the attributes must not make a
    // row stop matching itself.
    expect(combinationKey(['v-red', 'v-s'])).toBe(combinationKey(['v-s', 'v-red']))
  })

  it('still tells different combinations apart', () => {
    expect(combinationKey(['v-red', 'v-s'])).not.toBe(combinationKey(['v-red', 'v-m']))
  })
})

describe('combinationsOf', () => {
  it('produces every combination of one value per attribute', () => {
    // 9.2 — ticking Red, Green x S, M offers exactly four combinations.
    expect(combinationsOf([colour, size])).toEqual([
      ['v-red', 'v-s'],
      ['v-red', 'v-m'],
      ['v-green', 'v-s'],
      ['v-green', 'v-m'],
    ])
  })

  it('ignores an attribute with nothing selected on it', () => {
    const empty: SelectedAttribute = { ...size, valueIds: [] }
    expect(combinationsOf([colour, empty])).toEqual([['v-red'], ['v-green']])
  })

  it('returns nothing when no attribute has a selection', () => {
    expect(combinationsOf([])).toEqual([])
  })
})

describe('rebuildCombinations', () => {
  it('9.1 — an attribute defined once produces combinations on a product that has none', () => {
    const result = rebuildCombinations([colour], [], defaults())

    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((r) => r.name)).toEqual(['Red', 'Green'])
    // Nothing was invented: a brand-new combination starts unstocked.
    expect(result.rows.every((r) => r.stockQuantity === 0)).toBe(true)
    expect(result.rows.every((r) => r.offerPrice === 100)).toBe(true)
  })

  it('9.2 — unticking a value removes only that value’s combinations', () => {
    const before = rebuildCombinations([colour, size], [], defaults()).rows.map((row) =>
      existing({
        variantKey: row.variantKey,
        name: row.name,
        sku: row.sku,
        offerPrice: row.offerPrice,
        stockQuantity: 7,
        valueIds: row.valueIds,
      }),
    )

    const withoutGreen: SelectedAttribute = { ...colour, valueIds: ['v-red'] }
    const result = rebuildCombinations([withoutGreen, size], before, defaults())

    expect(result.rows.map((r) => r.name)).toEqual(['Red / S', 'Red / M'])
    // The two Red rows survive untouched; only the Green ones are gone.
    expect(result.rows.every((r) => r.stockQuantity === 7)).toBe(true)
    expect(result.removed.map((r) => r.name)).toEqual(['Green / S', 'Green / M'])
  })

  it('9.3 — adding a value leaves every existing combination’s stock, offerPrice, code and identity alone', () => {
    // Four combinations, each individually stocked and coded. This is the exact
    // situation that lost four variants' stock before this change.
    const before: ExistingVariant[] = [
      existing({ variantKey: 'db-1', name: 'Red / S', sku: 'RS', offerPrice: 111, stockQuantity: 11, valueIds: ['v-red', 'v-s'] }),
      existing({ variantKey: 'db-2', name: 'Red / M', sku: 'RM', offerPrice: 122, stockQuantity: 22, valueIds: ['v-red', 'v-m'] }),
      existing({ variantKey: 'db-3', name: 'Green / S', sku: 'GS', offerPrice: 133, stockQuantity: 33, valueIds: ['v-green', 'v-s'] }),
      existing({ variantKey: 'db-4', name: 'Green / M', sku: 'GM', offerPrice: 144, stockQuantity: 44, valueIds: ['v-green', 'v-m'] }),
    ]

    const sizeWithXl = attribute('a-size', 'Size', [
      ['v-s', 'S'],
      ['v-m', 'M'],
      ['v-xl', 'XL'],
    ])

    const result = rebuildCombinations([colour, sizeWithXl], before, defaults())

    expect(result.rows).toHaveLength(6)

    // Every original row kept its database id — which is what makes the backend
    // update rather than delete-and-recreate, and so what preserves its images
    // and its links from past orders.
    for (const source of before) {
      const kept = result.rows.find((row) => row.id === source.id)
      expect(kept, `${source.name} survived`).toBeDefined()
      expect(kept?.sku).toBe(source.sku)
      expect(kept?.offerPrice).toBe(source.offerPrice)
      expect(kept?.stockQuantity).toBe(source.stockQuantity)
      expect(kept?.variantKey).toBe(source.variantKey)
    }

    // The two genuinely new combinations start from the product offerPrice with no
    // stock — stock is never invented for something never counted.
    const fresh = result.rows.filter((row) => !row.id)
    expect(fresh.map((r) => r.name)).toEqual(['Red / XL', 'Green / XL'])
    expect(fresh.every((r) => r.stockQuantity === 0 && r.offerPrice === 100)).toBe(true)

    // And nothing was dropped, so nothing needs warning about.
    expect(result.removed).toEqual([])
    expect(describeCarryOverLoss(result)).toBeNull()
  })

  it('9.3 — the match does not depend on the order the values happen to be listed in', () => {
    const before = [
      existing({
        variantKey: 'db-1',
        name: 'Red / S',
        sku: 'RS',
        stockQuantity: 99,
        // Stored the other way round from how the attributes are iterated.
        valueIds: ['v-s', 'v-red'],
      }),
    ]

    const result = rebuildCombinations([colour, size], before, defaults())
    const redS = result.rows.find((row) => row.name === 'Red / S')

    expect(redS?.id).toBe('db-1')
    expect(redS?.stockQuantity).toBe(99)
  })

  it('9.4 — a legacy variant with no selection is matched by its name', () => {
    // A product like Q86: variants named "Black", "White", authored before
    // options existed, so they carry no value ids to match on.
    const legacy = [
      existing({ variantKey: 'db-black', name: 'Black', sku: 'Q86-BK', offerPrice: 750, stockQuantity: 5 }),
      existing({ variantKey: 'db-white', name: 'White', sku: 'Q86-WH', offerPrice: 750, stockQuantity: 3 }),
    ]

    const q86Colour = attribute('a-colour', 'Colour', [
      ['v-black', 'Black'],
      ['v-white', 'White'],
    ])

    const result = rebuildCombinations([q86Colour], legacy, defaults())

    expect(result.rows.map((r) => [r.name, r.sku, r.stockQuantity])).toEqual([
      ['Black', 'Q86-BK', 5],
      ['White', 'Q86-WH', 3],
    ])
    expect(result.removed).toEqual([])
  })

  it('matches a legacy variant whose name differs only in case', () => {
    const legacy = [existing({ variantKey: 'db-1', name: 'black', sku: 'BK', stockQuantity: 4 })]
    const q86Colour = attribute('a-colour', 'Colour', [['v-black', 'Black']])

    const result = rebuildCombinations([q86Colour], legacy, defaults())

    expect(result.rows[0].id).toBe('db-1')
    expect(result.rows[0].stockQuantity).toBe(4)
  })

  it('never lets two combinations claim the same existing row', () => {
    // Two combinations rendering as the same name must not both take the row —
    // that would duplicate one variant's identity across two.
    const legacy = [existing({ variantKey: 'db-1', name: 'Red', sku: 'R', stockQuantity: 9 })]
    const twoReds = attribute('a-colour', 'Colour', [
      ['v-red', 'Red'],
      ['v-red2', 'Red'],
    ])

    const result = rebuildCombinations([twoReds], legacy, defaults())

    expect(result.rows.filter((row) => row.id === 'db-1')).toHaveLength(1)
    expect(result.rows.filter((row) => !row.id)).toHaveLength(1)
  })

  it('9.11 — a product selling no attribute values has no combinations', () => {
    const result = rebuildCombinations([], [], defaults())
    expect(result.rows).toEqual([])
  })

  it('warns when adding a whole attribute cannot carry existing rows over', () => {
    // The spec's named case: rows describing one axis cannot survive a second
    // being added, so the merchant has to agree first.
    const before = [
      existing({ variantKey: 'db-1', name: 'Vintage', sku: 'V', stockQuantity: 12 }),
    ]

    const result = rebuildCombinations([colour, size], before, defaults())

    expect(result.unmatched.map((r) => r.name)).toEqual(['Vintage'])
    const warning = describeCarryOverLoss(result)
    expect(warning).toContain('Vintage')
    // It says the stock is at stake, because that is the consequence.
    expect(warning).toContain('stock')
  })

  it('does not warn about a row the merchant deliberately deselected', () => {
    const before = [
      existing({ variantKey: 'db-1', name: 'Red', sku: 'R', stockQuantity: 5, valueIds: ['v-red'] }),
      existing({ variantKey: 'db-2', name: 'Green', sku: 'G', stockQuantity: 5, valueIds: ['v-green'] }),
    ]
    const onlyRed: SelectedAttribute = { ...colour, valueIds: ['v-red'] }

    const result = rebuildCombinations([onlyRed], before, defaults())

    expect(result.removed.map((r) => r.name)).toEqual(['Green'])
    // Removed on purpose, so the ordinary delete guard is enough — no warning.
    expect(describeCarryOverLoss(result)).toBeNull()
  })
})
