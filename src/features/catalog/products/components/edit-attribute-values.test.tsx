import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * What the product form is allowed to do to an attribute it does not own.
 *
 * The load-bearing assertion is the first one: every edit here must go through
 * the value-scoped endpoints, never `PATCH /attributes/:id` carrying a `values`
 * array. That endpoint reconciles against the array it is given and deletes
 * whatever is missing from it, so a payload built from a list this page fetched
 * minutes ago would silently drop a colour another admin added meanwhile. The
 * rest cover the two refusals a merchant can actually hit.
 */

const createValue = vi.hoisted(() => vi.fn())
const updateValue = vi.hoisted(() => vi.fn())
const deleteValue = vi.hoisted(() => vi.fn())
const updateAttribute = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/attributes', () => ({
  useUpdateAttribute: () => ({ mutateAsync: updateAttribute, isPending: false }),
  useCreateAttributeValue: () => ({ mutateAsync: createValue, isPending: false }),
  useUpdateAttributeValue: () => ({ mutateAsync: updateValue, isPending: false }),
  useDeleteAttributeValue: () => ({ mutateAsync: deleteValue, isPending: false }),
}))

const { EditAttributeValues } = await import(
  '@/features/catalog/products/components/edit-attribute-values'
)
type Attribute = import('@/lib/api/attributes').Attribute

const value = (id: string, label: string) => ({
  id,
  attributeId: 'colour',
  label,
  position: 0,
  swatch: null,
})

const COLOUR: Attribute = {
  id: 'colour',
  name: 'Colour',
  position: 0,
  presentation: 'LABEL',
  values: [value('black', 'Black'), value('white', 'White')],
  createdAt: '',
  updatedAt: '',
}

function renderDialog(
  over: Partial<React.ComponentProps<typeof EditAttributeValues>> = {},
  attribute: Attribute = COLOUR,
) {
  const onValueCreated = vi.fn()
  const onValueDeleted = vi.fn()
  render(
    <EditAttributeValues
      attribute={attribute}
      open
      onOpenChange={vi.fn()}
      onValueCreated={onValueCreated}
      onValueDeleted={onValueDeleted}
      {...over}
    />,
  )
  return { onValueCreated, onValueDeleted }
}

beforeEach(() => {
  createValue.mockReset().mockResolvedValue(value('navy', 'Navy'))
  updateValue.mockReset().mockResolvedValue(value('black', 'Jet Black'))
  deleteValue.mockReset().mockResolvedValue(undefined)
  updateAttribute.mockReset().mockResolvedValue(COLOUR)
})

describe('EditAttributeValues', () => {
  it('adds a value against the value endpoint, never the whole-attribute one', async () => {
    const user = userEvent.setup()
    const { onValueCreated } = renderDialog()

    await user.type(screen.getByLabelText('New value'), 'Navy')
    await user.click(screen.getByRole('button', { name: /add value/i }))

    await waitFor(() =>
      expect(createValue).toHaveBeenCalledWith({
        attributeId: 'colour',
        input: { label: 'Navy' },
      }),
    )
    // The guard this whole component exists for: had it sent `values`, Black
    // and White would have to be in it or the backend would delete them.
    expect(updateAttribute).not.toHaveBeenCalled()
    // Ticked on arrival — the merchant added it in order to sell it.
    expect(onValueCreated).toHaveBeenCalledWith(value('navy', 'Navy'))
  })

  it('renames a value in place, so products selling it keep selling it', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Edit Black' }))
    const field = screen.getByLabelText('Rename Black')
    await user.clear(field)
    await user.type(field, 'Jet Black')
    await user.click(screen.getByRole('button', { name: 'Save Black' }))

    await waitFor(() =>
      expect(updateValue).toHaveBeenCalledWith({
        attributeId: 'colour',
        valueId: 'black',
        input: { label: 'Jet Black' },
      }),
    )
    expect(updateAttribute).not.toHaveBeenCalled()
  })

  it('asks before removing a value products still sell, then forces it', async () => {
    const user = userEvent.setup()
    deleteValue.mockRejectedValueOnce(new Error('2 products still sell "Black".'))
    const { onValueDeleted } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Delete Black' }))

    // Refused, not applied: the merchant is told the scale first.
    await screen.findByText(/2 products still sell/i)
    expect(onValueDeleted).not.toHaveBeenCalled()

    deleteValue.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: /remove anyway/i }))

    await waitFor(() =>
      expect(deleteValue).toHaveBeenLastCalledWith({
        attributeId: 'colour',
        valueId: 'black',
        force: true,
      }),
    )
    // The product's own selection has to lose it too, or it would save a
    // reference to a value the backend no longer has.
    expect(onValueDeleted).toHaveBeenCalledWith('black')
  })

  it('refuses to delete the only value rather than offering a confirm', async () => {
    const only: Attribute = { ...COLOUR, values: [value('black', 'Black')] }
    renderDialog({}, only)

    // Disabled rather than left to fail on the backend: "an attribute needs a
    // value" is a refusal with no yes on the other side of it, so offering
    // "Remove anyway" would promise something the retry cannot deliver.
    expect(
      (screen.getByRole('button', { name: 'Delete Black' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('saves a renamed attribute without its values array', async () => {
    const user = userEvent.setup()
    renderDialog()

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Colour family')
    await user.tab()

    await waitFor(() =>
      expect(updateAttribute).toHaveBeenCalledWith({
        id: 'colour',
        input: { name: 'Colour family' },
      }),
    )
    // Same trap as the add case: `values` here would make the backend
    // reconcile, and reconcile means delete.
    expect(updateAttribute.mock.calls[0][0].input).not.toHaveProperty('values')
  })

  it('does not save the attribute when nothing about it changed', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByLabelText('Name'))
    await user.tab()

    expect(updateAttribute).not.toHaveBeenCalled()
  })
})
