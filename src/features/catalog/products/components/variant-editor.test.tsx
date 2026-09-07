import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariantEditor } from '@/features/catalog/products/components/variant-editor'
import type { CombinationRow } from '@/features/catalog/products/components/variant-combinations'
import type { Attribute } from '@/lib/api/attributes'

/**
 * Asserts `specs/catalog-management` — "Combinations that cannot be carried
 * over are confirmed before they are lost" and "Stock is displayed on the
 * authoring page but never set there".
 *
 * The change this component exists to make is that ticking a value *is* the
 * edit: the old "Generate variants" button rebuilt every row, so adding one
 * size meant re-stocking the rows you already had. Every test here is really
 * asking whether a surviving row survived whole.
 */

const value = (id: string, label: string, attributeId: string) => ({
  id,
  attributeId,
  label,
  position: 0,
  swatch: null,
})

const COLOUR: Attribute = {
  id: 'colour',
  name: 'Colour',
  position: 0,
  presentation: 'LABEL',
  values: [value('red', 'Red', 'colour'), value('blue', 'Blue', 'colour')],
  createdAt: '',
  updatedAt: '',
}

const ATTRIBUTES = [COLOUR]

const row = (over: Partial<CombinationRow> & { variantKey: string }): CombinationRow => ({
  valueIds: [],
  name: '',
  sku: '',
  offerPrice: 0,
  stockQuantity: 0,
  ...over,
})

function Harness({
  initialSelected = [],
  initialRows = [],
  onRowRemoved,
  onEditAttribute,
}: {
  initialSelected?: string[]
  initialRows?: CombinationRow[]
  onRowRemoved?: (key: string) => void
  onEditAttribute?: (attribute: Attribute) => void
}) {
  const [selected, setSelected] = React.useState<string[]>(initialSelected)
  const [rows, setRows] = React.useState<CombinationRow[]>(initialRows)

  return (
    <>
      <VariantEditor
        attributes={ATTRIBUTES}
        selectedValueIds={selected}
        onSelectedValueIdsChange={setSelected}
        rows={rows}
        onRowsChange={setRows}
        basePrice={100}
        skuPrefix="base"
        nextVariantKey={() => `__new_${Math.round(performance.now() * 1000)}`}
        pendingImages={[]}
        onPendingImagesChange={() => {}}
        onRowRemoved={onRowRemoved}
        onEditAttribute={onEditAttribute}
      />
      <output data-testid="state">
        {JSON.stringify({
          selected,
          rows: rows.map((r) => ({
            name: r.name,
            sku: r.sku,
            offerPrice: r.offerPrice,
            sellingPrice: r.sellingPrice ?? null,
            stockQuantity: r.stockQuantity,
          })),
        })}
      </output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}')

describe('VariantEditor', () => {
  it('carries every surviving combination over when a value is added', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialSelected={['red']}
        initialRows={[
          row({ variantKey: 'v1', id: 'v1', valueIds: ['red'], name: 'Red', sku: 'base-red', offerPrice: 120, sellingPrice: 150, stockQuantity: 7 }),
        ]}
      />,
    )

    await user.click(screen.getByLabelText('Blue'))

    await waitFor(() => expect(state().rows).toHaveLength(2))
    // The row that already existed keeps its code, both prices and its stock.
    expect(state().rows[0]).toEqual({
      name: 'Red',
      sku: 'base-red',
      offerPrice: 120,
      sellingPrice: 150,
      stockQuantity: 7,
    })
  })

  /*
   * What actually triggers the warning is narrower than "a row disappeared".
   *
   * `rebuildCombinations` treats a removed row that still carried a value
   * selection as deliberately deselected — the merchant just said so by
   * unticking it. The row that has to be warned about is the one carrying NO
   * selection, which neither the value pass nor the name pass can place: the
   * single default row of a product that used to sell no attributes at all.
   * Its stock has nowhere to go. See `variant-combinations.ts`, `unmatched`.
   */
  const UNPLACEABLE = [
    row({ variantKey: 'v0', id: 'v0', valueIds: [], name: 'Default', sku: 'base', stockQuantity: 9 }),
  ]

  it('asks before a change that cannot carry a combination over, and changes nothing until answered', async () => {
    const user = userEvent.setup()
    render(<Harness initialSelected={[]} initialRows={UNPLACEABLE} />)

    await user.click(screen.getByLabelText('Red'))

    await waitFor(() =>
      expect(screen.getByText('Some combinations cannot be carried over')).not.toBeNull(),
    )
    // Neither the selection nor the table has moved.
    expect(state().selected).toEqual([])
    expect(state().rows).toHaveLength(1)
    expect(state().rows[0].name).toBe('Default')
  })

  it('names what would be lost, and says when it holds stock', async () => {
    const user = userEvent.setup()
    render(<Harness initialSelected={[]} initialRows={UNPLACEABLE} />)

    await user.click(screen.getByLabelText('Red'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Default')
    expect(dialog.textContent).toContain('stock')
  })

  it('leaves everything as it was when the merchant declines', async () => {
    const onRowRemoved = vi.fn()
    const user = userEvent.setup()
    render(<Harness initialSelected={[]} initialRows={UNPLACEABLE} onRowRemoved={onRowRemoved} />)

    await user.click(screen.getByLabelText('Red'))
    await user.click(await screen.findByRole('button', { name: 'Leave things as they are' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state().selected).toEqual([])
    expect(state().rows).toHaveLength(1)
    expect(onRowRemoved).not.toHaveBeenCalled()
  })

  it('applies and releases the removed row’s media when the merchant confirms', async () => {
    const onRowRemoved = vi.fn()
    const user = userEvent.setup()
    render(<Harness initialSelected={[]} initialRows={UNPLACEABLE} onRowRemoved={onRowRemoved} />)

    await user.click(screen.getByLabelText('Red'))
    await user.click(await screen.findByRole('button', { name: 'Apply anyway' }))

    await waitFor(() => expect(state().selected).toEqual(['red']))
    expect(state().rows).toHaveLength(1)
    expect(state().rows[0].name).toBe('Red')
    expect(onRowRemoved).toHaveBeenCalledWith('v0')
  })

  it('applies a deliberate deselection without asking, releasing that row’s media', async () => {
    const onRowRemoved = vi.fn()
    const user = userEvent.setup()
    render(
      <Harness
        initialSelected={['red', 'blue']}
        initialRows={[
          row({ variantKey: 'v1', id: 'v1', valueIds: ['red'], name: 'Red', sku: 'base-red', stockQuantity: 3 }),
          row({ variantKey: 'v2', id: 'v2', valueIds: ['blue'], name: 'Blue', sku: 'base-blue', stockQuantity: 5 }),
        ]}
        onRowRemoved={onRowRemoved}
      />,
    )

    await user.click(screen.getByLabelText('Blue'))

    // No confirmation: unticking Blue IS the merchant saying to drop it.
    await waitFor(() => expect(state().selected).toEqual(['red']))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state().rows).toHaveLength(1)
    expect(onRowRemoved).toHaveBeenCalledWith('v2')
  })

  it('draws a partly-selected attribute as neither on nor off', async () => {
    render(<Harness initialSelected={['red']} initialRows={[row({ variantKey: 'v1', valueIds: ['red'], name: 'Red' })]} />)

    // Showing it as unchecked would invite a click that selects everything when
    // the merchant meant to clear the one already ticked.
    expect(screen.getByLabelText('Colour').getAttribute('data-state')).toBe('indeterminate')
  })

  it('shows a combination’s stock as text, with nothing to type into', () => {
    render(
      <Harness
        initialSelected={['red']}
        initialRows={[row({ variantKey: 'v1', id: 'v1', valueIds: ['red'], name: 'Red', sku: 'base-red', stockQuantity: 42 })]}
      />,
    )

    expect(screen.getByText('42')).not.toBeNull()
    // The ledger is the only writer — there is a code and two prices to edit here, and no stock.
    expect(screen.queryByLabelText('Stock for Red')).toBeNull()
    expect(screen.getByLabelText('Product code for Red')).not.toBeNull()
    expect(screen.getByLabelText('Offer price for Red')).not.toBeNull()
  })

  it('clears the regular price to unset rather than to zero', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initialSelected={['red']}
        initialRows={[
          row({ variantKey: 'v1', id: 'v1', valueIds: ['red'], name: 'Red', sku: 'base-red', offerPrice: 120, sellingPrice: 150 }),
        ]}
      />,
    )

    await user.clear(screen.getByLabelText('Regular price for Red'))

    // `Number('')` is 0, which would read as "on offer, regular price zero".
    await waitFor(() => expect(state().rows[0].sellingPrice).toBeNull())
  })

  it('explains that attributes are shop-wide when none are defined', () => {
    render(
      <VariantEditor
        attributes={[]}
        selectedValueIds={[]}
        onSelectedValueIdsChange={() => {}}
        rows={[]}
        onRowsChange={() => {}}
        basePrice={0}
        skuPrefix=""
        nextVariantKey={() => 'k'}
        pendingImages={[]}
        onPendingImagesChange={() => {}}
      />,
    )

    expect(screen.getByText('No attributes defined yet')).not.toBeNull()
  })

  /*
   * The checkboxes answer "which of these does this product sell?" — they have
   * never had an answer to "none of these is the colour I stock". That sent the
   * merchant to Catalog → Attributes with a part-filled product behind them,
   * which is the same round-trip quick-create was built to close for a whole
   * attribute. This is the handle on it.
   */
  it('offers editing an existing attribute, naming which one', async () => {
    const user = userEvent.setup()
    const onEditAttribute = vi.fn()
    render(<Harness onEditAttribute={onEditAttribute} />)

    await user.click(screen.getByRole('button', { name: 'Edit Colour values' }))

    expect(onEditAttribute).toHaveBeenCalledWith(COLOUR)
  })

  it('leaves the group unadorned when editing is not offered', () => {
    render(<Harness />)

    expect(screen.queryByRole('button', { name: /edit colour/i })).toBeNull()
  })
})
