import { describe, expect, it, vi, beforeEach } from 'vitest'

// A full form plus a repeatable list; the default 5s is a scheduling artifact
// once the suite runs its files in parallel.
vi.setConfig({ testTimeout: 20_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * What `specs/catalog-management` promises about the attribute values editor,
 * asserted against the real page.
 *
 * This is the page the whole antd removal was most likely to break silently.
 * `Form.List` gave array-level `rules` and `Form.ErrorList` for free; zod plus
 * `useFieldArray` raises the same issues and renders nothing for them unless
 * they are routed deliberately — so "the save is refused and the screen says
 * nothing" is the specific regression these tests exist to catch.
 *
 * The four that fail invisibly come first: order, the duplicate refusal, the
 * at-least-one floor, and the 409 hand-back.
 *
 * See openspec/changes/remove-antd-from-admin, task 4.5.
 */

interface Stub {
  attributeId?: string
  attribute?: Record<string, unknown>
}

const stub = vi.hoisted(() => ({ attributeId: undefined, attribute: undefined }) as Stub)
const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ attributeId: stub.attributeId }),
  }
})

vi.mock('@/lib/api/attributes', () => ({
  useAttribute: () => ({ data: stub.attribute, isLoading: false, error: undefined }),
  useCreateAttribute: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateAttribute: () => ({ mutateAsync: updateMutate, isPending: false }),
}))
vi.mock('@/features/catalog/attributes/attributes-page', () => ({
  ATTRIBUTES_PATH: '/catalog/attributes',
}))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

// `@/lib/api/client` is deliberately NOT mocked: the page branches on a real
// `instanceof ApiError`, so a stand-in class would take the wrong branch.
import { ApiError } from '@/lib/api/client'
import AttributeFormPage from '@/features/catalog/attributes/attribute-form-page'

const attribute = (values: { id: string; label: string; swatch?: string | null }[]) => ({
  id: 'attr-1',
  name: 'Colour',
  position: 0,
  presentation: 'LABEL',
  values: values.map((v, i) => ({
    id: v.id,
    attributeId: 'attr-1',
    label: v.label,
    position: i,
    swatch: v.swatch ?? null,
  })),
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const valueBox = (index: number) => screen.getByLabelText(`Value ${index}`) as HTMLInputElement
const rowLabels = () =>
  screen
    .queryAllByRole('textbox')
    .map((el) => el.getAttribute('aria-label'))
    .filter((name) => name?.startsWith('Value '))
    .map((name) => (screen.getByLabelText(name as string) as HTMLInputElement).value)

const addValue = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Add value' }))
const saveAndStay = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save and continue editing' }))

/** Types a fresh label into row `index` (1-based), replacing whatever is there. */
const setValue = async (
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  label: string,
) => {
  await user.clear(valueBox(index))
  await user.type(valueBox(index), label)
}

const choosePresentation = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByLabelText('Shown as'))
  await user.click(await screen.findByRole('option', { name: label }))
}

beforeEach(() => {
  // Radix's Select measures and captures the pointer; jsdom implements neither.
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()

  stub.attributeId = undefined
  stub.attribute = undefined
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  createMutate.mockResolvedValue({ id: 'attr-1' })
  updateMutate.mockResolvedValue(undefined)
})

describe('AttributeFormPage — values are stored in the order they were arranged', () => {
  it('sends S, M, L, XL in the merchant’s order, not alphabetically', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Size')
    await setValue(user, 1, 'S')
    for (const [i, label] of ['M', 'L', 'XL'].entries()) {
      await addValue(user)
      await setValue(user, i + 2, label)
    }

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].values.map((v: { label: string }) => v.label)).toEqual([
      'S',
      'M',
      'L',
      'XL',
    ])
  })

  it('moves a row up and sends the new order, with both identities intact', async () => {
    const user = userEvent.setup()
    stub.attributeId = 'attr-1'
    stub.attribute = attribute([
      { id: 'v-red', label: 'Red' },
      { id: 'v-blue', label: 'Blue' },
    ])
    render(<AttributeFormPage />)

    await waitFor(() => expect(rowLabels()).toEqual(['Red', 'Blue']))
    await user.click(screen.getAllByRole('button', { name: 'Move up' })[1])
    expect(rowLabels()).toEqual(['Blue', 'Red'])

    await saveAndStay(user)

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    // Identities travel with the rows, so products selling them are unaffected.
    expect(updateMutate.mock.calls[0][0].input.values).toEqual([
      { id: 'v-blue', label: 'Blue', swatch: undefined },
      { id: 'v-red', label: 'Red', swatch: undefined },
    ])
  })

  it('offers no way to move the first row up or the last row down', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await setValue(user, 1, 'Red')
    await addValue(user)
    await setValue(user, 2, 'Blue')

    const up = screen.getAllByRole('button', { name: 'Move up' }) as HTMLButtonElement[]
    const down = screen.getAllByRole('button', { name: 'Move down' }) as HTMLButtonElement[]
    expect(up[0].disabled).toBe(true)
    expect(down[1].disabled).toBe(true)
    expect(up[1].disabled).toBe(false)
    expect(down[0].disabled).toBe(false)
  })

  it('discards a row left blank rather than storing an unnamed value', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    // Added and then left alone — the usual way a stray row appears.
    await addValue(user)

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].values).toEqual([
      { id: undefined, label: 'Red', swatch: undefined },
    ])
  })
})

describe('AttributeFormPage — two values that read as the same choice', () => {
  it('refuses "Red" twice, against the list, and keeps both rows', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    await addValue(user)
    await setValue(user, 2, 'Red')

    await saveAndStay(user)

    expect(await screen.findByText('Two values read as the same choice')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
    // Refused, not cleared: both rows still hold what was typed.
    expect(rowLabels()).toEqual(['Red', 'Red'])
  })

  it('refuses "Red" and "red" for the same reason', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    await addValue(user)
    await setValue(user, 2, 'red')

    await saveAndStay(user)

    expect(await screen.findByText('Two values read as the same choice')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('lets distinct labels through', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    await addValue(user)
    await setValue(user, 2, ' Blue ')

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].values.map((v: { label: string }) => v.label)).toEqual([
      'Red',
      'Blue',
    ])
  })
})

describe('AttributeFormPage — an attribute keeps at least one value', () => {
  it('refuses a save that removes every row, with the reason against the list', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await user.click(screen.getByRole('button', { name: 'Remove value' }))
    expect(screen.queryByLabelText('Value 1')).toBeNull()

    await saveAndStay(user)

    // There is not even a row left to hang this on — it has to be the group's.
    expect(await screen.findByText('An attribute needs at least one value')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('refuses a save where every remaining row is blank', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    await user.clear(valueBox(1))

    await saveAndStay(user)

    expect(await screen.findByText('An attribute needs at least one value')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('proceeds once exactly one value carries a label', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
  })
})

describe('AttributeFormPage — a swatch is offered only for a swatch attribute', () => {
  it('shows the colour controls on existing rows the moment the presentation changes', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await setValue(user, 1, 'Red')
    await addValue(user)
    await setValue(user, 2, 'Blue')
    expect(screen.queryByLabelText('Colour for value 1')).toBeNull()

    await choosePresentation(user, 'Colour swatches')

    // No save, no reload: both rows now carry a colour control.
    expect(await screen.findByLabelText('Colour for value 1')).toBeTruthy()
    expect(screen.getByLabelText('Colour for value 2')).toBeTruthy()
  })

  it('sends no swatch while the attribute is presented as labelled chips', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')

    // Set a colour, then go back to chips: the swatch must not travel.
    await choosePresentation(user, 'Colour swatches')
    await user.type(await screen.findByLabelText('Colour for value 1'), '#ff0000')
    await choosePresentation(user, 'Labelled chips')

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].values[0].swatch).toBeUndefined()
  })

  it('sends the swatch a merchant typed once the attribute is presented as swatches', async () => {
    const user = userEvent.setup()
    render(<AttributeFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Colour')
    await setValue(user, 1, 'Red')
    await choosePresentation(user, 'Colour swatches')
    await user.type(await screen.findByLabelText('Colour for value 1'), '#ff0000')

    await saveAndStay(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].values[0].swatch).toBe('#ff0000')
  })
})

describe('AttributeFormPage — removing values products still sell', () => {
  it('offers to remove them anyway, and re-sends the same arrangement on confirmation', async () => {
    const user = userEvent.setup()
    stub.attributeId = 'attr-1'
    stub.attribute = attribute([
      { id: 'v-red', label: 'Red' },
      { id: 'v-blue', label: 'Blue' },
    ])
    updateMutate.mockRejectedValueOnce(
      new ApiError('2 products still sell "Blue"', 409),
    )
    render(<AttributeFormPage />)

    await waitFor(() => expect(rowLabels()).toEqual(['Red', 'Blue']))
    await user.click(screen.getAllByRole('button', { name: 'Remove value' })[1])
    await saveAndStay(user)

    // A decision, not a failure: the explanation and an offer, not a plain error.
    expect(await screen.findByText('Some products still sell the values you removed')).toBeTruthy()
    expect(screen.getByText('2 products still sell "Blue"')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Remove them anyway' }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(2))
    // The same arrangement, forced — nothing was re-entered.
    expect(updateMutate.mock.calls[1][0]).toMatchObject({ id: 'attr-1', force: true })
    expect(updateMutate.mock.calls[1][0].input.values).toEqual([
      { id: 'v-red', label: 'Red', swatch: undefined },
    ])
  })

  it('leaves the form exactly as arranged while the removal is unconfirmed', async () => {
    const user = userEvent.setup()
    stub.attributeId = 'attr-1'
    stub.attribute = attribute([
      { id: 'v-red', label: 'Red' },
      { id: 'v-blue', label: 'Blue' },
    ])
    updateMutate.mockRejectedValueOnce(new ApiError('2 products still sell "Blue"', 409))
    render(<AttributeFormPage />)

    await waitFor(() => expect(rowLabels()).toEqual(['Red', 'Blue']))
    await user.click(screen.getAllByRole('button', { name: 'Remove value' })[1])
    await saveAndStay(user)

    await screen.findByText('Some products still sell the values you removed')

    // Not confirmed: one request was made, and the explanation is still there.
    expect(updateMutate).toHaveBeenCalledTimes(1)
    expect(rowLabels()).toEqual(['Red'])
    expect(screen.getByText('Some products still sell the values you removed')).toBeTruthy()
  })

  it('still reports a refusal that is not the removal guard as an ordinary failure', async () => {
    const user = userEvent.setup()
    stub.attributeId = 'attr-1'
    stub.attribute = attribute([{ id: 'v-red', label: 'Red' }])
    updateMutate.mockRejectedValueOnce(new ApiError('Colour is already an attribute', 400))
    render(<AttributeFormPage />)

    await waitFor(() => expect(rowLabels()).toEqual(['Red']))
    await saveAndStay(user)

    expect(await screen.findByText('Colour is already an attribute')).toBeTruthy()
    expect(screen.queryByText('Some products still sell the values you removed')).toBeNull()
  })
})
