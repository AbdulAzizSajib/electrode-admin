import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedRadioGroup } from '@/components/ui/radio-group'

/**
 * Asserts `admin-shell` — "Short mutually exclusive choices are one keyboard
 * group".
 *
 * The tab-stop assertion is the one that matters: a hand-rolled row of buttons
 * passes every other test here and still makes a keyboard user press Tab once
 * per option to get past the field.
 */

const OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unset', label: 'Not stated' },
]

function Harness({ onValueChange = () => {} }: { onValueChange?: (value: string) => void }) {
  return (
    <div>
      <button type="button">before</button>
      <SegmentedRadioGroup
        aria-label="Refundable"
        options={OPTIONS}
        defaultValue="no"
        onValueChange={onValueChange}
      />
      <button type="button">after</button>
    </div>
  )
}

describe('SegmentedRadioGroup', () => {
  it('is one tab stop, not one per option', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    screen.getByRole('button', { name: 'before' }).focus()

    await user.tab()
    // Focus lands inside the group — on its selected option.
    expect(screen.getByRole('radio', { name: 'No' })).toBe(document.activeElement)

    await user.tab()
    // One more Tab leaves the group entirely, rather than stepping to "Not stated".
    expect(screen.getByRole('button', { name: 'after' })).toBe(document.activeElement)
  })

  /*
   * The keys are HELD (`{ArrowRight>}`), not tapped, and the assertion waits.
   *
   * Radix moves roving focus in a `setTimeout`, and checks the newly focused
   * radio only if an arrow key is still down when that timer fires. A real
   * keypress easily spans a macrotask, but `user-event` dispatches keydown and
   * keyup back-to-back in one tick — so a tapped `{ArrowRight}` moves focus and
   * then finds the flag already cleared, and nothing is selected. Holding the
   * key models the browser; tapping it would only assert jsdom's scheduling.
   */
  it('moves the selection with the arrow keys', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onValueChange={onValueChange} />)

    screen.getByRole('radio', { name: 'No' }).focus()
    await user.keyboard('{ArrowRight>}')

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('unset'))
    expect(screen.getByRole('radio', { name: 'Not stated' }).getAttribute('aria-checked')).toBe('true')

    await user.keyboard('{/ArrowRight}{ArrowLeft>}')
    await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('no'))
    expect(screen.getByRole('radio', { name: 'No' }).getAttribute('aria-checked')).toBe('true')
  })

  it('names the group and each option', () => {
    render(<Harness />)

    expect(screen.getByRole('radiogroup', { name: 'Refundable' })).not.toBeNull()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    for (const option of OPTIONS) {
      expect(screen.getByRole('radio', { name: option.label })).not.toBeNull()
    }
  })

  it('reports exactly one option as checked', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name: 'Yes' }))

    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toBe('Yes')
  })
})
