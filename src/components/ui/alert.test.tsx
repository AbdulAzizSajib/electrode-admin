import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Alert } from '@/components/ui/alert'

/**
 * Asserts `admin-shell` — "Page-level messages carry a severity and can be
 * dismissed".
 *
 * The severity assertions deliberately read the visually-hidden word rather
 * than a class name: the requirement is that the three are told apart with
 * colour removed, and a class assertion would pass on a stylesheet that renders
 * all three identically.
 *
 * Plain `expect` throughout — this project does not install jest-dom, and its
 * existing suites assert on values and queries rather than on custom matchers.
 */

describe('Alert', () => {
  it('announces a failure message without moving focus to it', () => {
    render(<Alert variant="destructive" title="Could not save this product" />)

    expect(screen.getByRole('alert').textContent).toContain('Could not save this product')
    // Announced where it stands — nothing was focused to make that happen.
    expect(document.activeElement).toBe(document.body)
  })

  it('announces a cautionary message', () => {
    render(<Alert variant="warning" title="Could not load brands and tax rules" />)
    expect(screen.getByRole('alert').textContent).toContain('Could not load brands and tax rules')
  })

  it('does not interrupt for an informational message', () => {
    render(<Alert variant="default" title="Available after saving" />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Available after saving')).not.toBeNull()
  })

  it('tells severities apart without colour', () => {
    const { rerender } = render(<Alert variant="default" title="Note" />)
    expect(screen.getByText('Information:')).not.toBeNull()

    rerender(<Alert variant="warning" title="Note" />)
    expect(screen.getByText('Warning:')).not.toBeNull()

    rerender(<Alert variant="destructive" title="Note" />)
    expect(screen.getByText('Error:')).not.toBeNull()
  })

  it('renders a description beneath the title', () => {
    render(
      <Alert variant="warning" title="Could not load brands">
        Those fields stay empty until the lists load.
      </Alert>,
    )

    expect(screen.getByText('Could not load brands')).not.toBeNull()
    expect(screen.getByText('Those fields stay empty until the lists load.')).not.toBeNull()
  })

  it('dismisses when the operator asks, leaving the rest of the page alone', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()

    render(
      <div>
        <Alert variant="destructive" title="Something went wrong" onDismiss={onDismiss} />
        <p>Still here</p>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Still here')).not.toBeNull()
  })

  it('offers no dismiss control for a condition still in force', () => {
    render(<Alert variant="warning" title="Could not load brands and tax rules" />)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })
})
