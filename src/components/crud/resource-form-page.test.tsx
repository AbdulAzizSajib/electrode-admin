import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form, Input } from 'antd'
import { MemoryRouter } from 'react-router'
import { ResourceFormPage } from '@/components/crud/resource-form-page'

/**
 * Task 9.12 — a rejected save preserves everything the merchant entered.
 *
 * The guarantee is about what is still on screen after the server says no, so
 * it is checked by rendering a real form, typing into it, failing the save and
 * reading the inputs back. Asserting it by inspecting the code would only prove
 * that today's code does not call `resetFields`; this proves the merchant's
 * work survives whatever the reason for the refusal.
 *
 * antd's Form warns about `useForm` not being connected during the first paint
 * in jsdom; that is noise from the test environment, not the component.
 */

interface Values {
  name: string
  note: string
}

const EMPTY: Values = { name: '', note: '' }

/** Reads a field back the way a merchant sees it, without a matcher library. */
const inputValue = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

function renderForm(onSave: (values: Values) => Promise<{ id?: string } | void>) {
  return render(
    <MemoryRouter>
      <ResourceFormPage<Values, never>
        noun="Widget"
        listPath="/widgets"
        emptyValues={EMPTY}
        toValues={() => EMPTY}
        onSave={onSave}
      >
        {() => (
          <>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
              <Input aria-label="Name" />
            </Form.Item>
            <Form.Item name="note" label="Note">
              <Input aria-label="Note" />
            </Form.Item>
          </>
        )}
      </ResourceFormPage>
    </MemoryRouter>,
  )
}

describe('ResourceFormPage — a rejected save', () => {
  it('9.12 leaves everything the merchant entered on the page', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('A widget named "Bolt" already exists'))

    renderForm(onSave)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.type(screen.getByLabelText('Note'), 'Half an hour of typing')

    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

    // Both fields still hold exactly what was typed — nothing was reset,
    // re-fetched over, or navigated away from.
    await waitFor(() => {
      expect(inputValue('Name')).toBe('Bolt')
      expect(inputValue('Note')).toBe('Half an hour of typing')
    })
  })

  it('9.12 shows the server’s own reason, not a generic failure', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('A widget named "Bolt" already exists'))

    renderForm(onSave)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    // The message names what actually went wrong, so the merchant can fix it.
    await waitFor(() =>
      expect(screen.getByText(/already exists/i)).toBeDefined(),
    )
  })

  it('does not call the server at all when a required field is empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    renderForm(onSave)

    await user.type(screen.getByLabelText('Note'), 'no name given')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    // The field-level message appears, the request never leaves, and the note
    // the merchant typed is still there.
    await waitFor(() => expect(screen.getByText('Name is required')).toBeDefined())
    expect(onSave).not.toHaveBeenCalled()
    expect(inputValue('Note')).toBe('no name given')
  })

  it('keeps the merchant on the form when they choose to continue editing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    renderForm(onSave)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // Still editing the same record, with its values intact.
    expect(inputValue('Name')).toBe('Bolt')
  })
})
