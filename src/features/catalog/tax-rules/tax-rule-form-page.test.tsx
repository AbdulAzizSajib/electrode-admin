import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * The one thing this page does that a list of fields does not: the charge's
 * label, its ceiling, its step and its unit all follow the type, and they have
 * to follow it as it is picked rather than after a save.
 *
 * Under antd that was `shouldUpdate` re-rendering a nested `Form.Item` with a
 * different `rules` array; it is now `useWatch` plus a `superRefine` over the
 * whole object. Both halves are asserted here because the second one is
 * invisible until a save is refused — a bound that quietly stopped applying
 * would let a 150% tax rule through and nothing on screen would say so.
 *
 * See openspec/changes/remove-antd-from-admin, task 3.7.
 */

const stub = vi.hoisted(() => ({ taxRuleId: undefined }) as { taxRuleId?: string })
const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ taxRuleId: stub.taxRuleId }) }
})

vi.mock('@/lib/api/tax-rules', () => ({
  useTaxRule: () => ({ data: undefined, isLoading: false, error: undefined }),
  useCreateTaxRule: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateTaxRule: () => ({ mutateAsync: updateMutate, isPending: false }),
}))
vi.mock('@/features/catalog/tax-rules/tax-rules-page', () => ({
  TAX_RULES_PATH: '/catalog/tax-rules',
}))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import TaxRuleFormPage from '@/features/catalog/tax-rules/tax-rule-form-page'

/**
 * Radix's Select measures and captures the pointer; jsdom implements neither.
 * Stubbed so the trigger can actually be opened — without these the click
 * throws and the conditional behaviour under test is unreachable.
 */
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()

  stub.taxRuleId = undefined
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  createMutate.mockResolvedValue({ id: 'tax-1' })
})

/** Opens the Type select and picks an option by its visible label. */
const chooseType = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByLabelText('Type'))
  await user.click(await screen.findByRole('option', { name: label }))
}

describe('TaxRuleFormPage — the value field follows the type', () => {
  it('relabels, rebounds and re-units the field the moment the type changes', async () => {
    const user = userEvent.setup()
    render(<TaxRuleFormPage />)

    // A new rule opens as a percentage.
    const percent = screen.getByLabelText('Percentage') as HTMLInputElement
    expect(percent.max).toBe('100')
    expect(percent.step).toBe('0.5')
    expect(screen.getByText('%')).toBeTruthy()
    expect(
      screen.getByText(/Applied to the price actually charged/),
    ).toBeTruthy()

    await chooseType(user, 'Fixed amount')

    // No save in between: the label, the ceiling, the step, the unit and the
    // help text have all moved on their own.
    const amount = (await screen.findByLabelText('Amount')) as HTMLInputElement
    expect(screen.queryByLabelText('Percentage')).toBeNull()
    expect(amount.max).toBe('')
    expect(amount.step).toBe('1')
    expect(screen.queryByText('%')).toBeNull()
    expect(screen.getByText('Charged per unit bought, whatever the price.')).toBeTruthy()

    await chooseType(user, 'Percentage of the price')
    expect(await screen.findByLabelText('Percentage')).toBeTruthy()
  })

  it('refuses 150 as a percentage, in the percentage’s own words', async () => {
    const user = userEvent.setup()
    render(<TaxRuleFormPage />)

    await user.type(screen.getByLabelText('Name'), 'VAT')
    const value = screen.getByLabelText('Percentage')
    await user.clear(value)
    await user.type(value, '150')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    expect(await screen.findByText('A percentage is between 0 and 100')).toBeTruthy()
    // Refused here, not by the server: nothing was sent.
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('accepts the same 150 once it is an amount', async () => {
    const user = userEvent.setup()
    render(<TaxRuleFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Handling')
    await chooseType(user, 'Fixed amount')

    const value = await screen.findByLabelText('Amount')
    await user.clear(value)
    await user.type(value, '150')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      name: 'Handling',
      type: 'FLAT',
      value: 150,
    })
  })

  it('still refuses a negative amount, in the amount’s own words', async () => {
    const user = userEvent.setup()
    render(<TaxRuleFormPage />)

    await user.type(screen.getByLabelText('Name'), 'Handling')
    await chooseType(user, 'Fixed amount')

    const value = await screen.findByLabelText('Amount')
    await user.clear(value)
    await user.type(value, '-5')

    await user.click(screen.getByRole('button', { name: 'Save and return' }))

    expect(await screen.findByText('An amount cannot be negative')).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })
})
