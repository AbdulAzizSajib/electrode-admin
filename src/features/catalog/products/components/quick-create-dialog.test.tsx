import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickCreateDialog } from '@/features/catalog/products/components/quick-create-dialog'

/**
 * The two guarantees `specs/catalog-management` and `specs/admin-shell` make
 * about a quick-create overlay that the shell — not any one of the six bodies —
 * is responsible for: a rejected create keeps what was typed, and a submit
 * inside the overlay never reaches the form it is rendered over.
 *
 * The second is the one with teeth. `DialogContent` portals out of the product
 * form's <form> element, so the DOM is safe, but React's synthetic events
 * propagate up the *React* tree — without `stopPropagation` in the shell,
 * creating a brand submits a half-filled product.
 */

function Harness({
  onSubmit,
  onProductSubmit,
  error,
  pending,
}: {
  onSubmit: () => void
  onProductSubmit: () => void
  error?: string | null
  pending?: boolean
}) {
  return (
    // Stands in for the product form the dialog is opened from.
    <form onSubmit={onProductSubmit}>
      <QuickCreateDialog
        open
        onOpenChange={() => {}}
        title="New brand"
        pending={pending}
        error={error}
        onSubmit={onSubmit}
      >
        <input aria-label="Name" defaultValue="Nike" />
      </QuickCreateDialog>
    </form>
  )
}

describe('QuickCreateDialog', () => {
  it('submits itself and not the form it is rendered over', async () => {
    const onSubmit = vi.fn()
    const onProductSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} onProductSubmit={onProductSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onProductSubmit).not.toHaveBeenCalled()
  })

  it('stays open with the reason and the typed values when a create is rejected', () => {
    render(
      <Harness
        onSubmit={vi.fn()}
        onProductSubmit={vi.fn()}
        error="A brand named Nike already exists"
      />,
    )

    expect(screen.getByText('A brand named Nike already exists')).not.toBeNull()
    // Still open, still holding what was typed — not reset, not closed.
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Nike')
  })

  it('refuses a second submit while one is in flight', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} onProductSubmit={vi.fn()} pending />)

    const submit = screen.getByRole('button', { name: /Creating/ })
    expect(submit.hasAttribute('disabled')).toBe(true)

    await user.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
