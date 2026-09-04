import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ResourceFormPageRhf } from '@/components/crud/resource-form-page-rhf'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

/**
 * Mirrors `resource-form-page.test.tsx` for the react-hook-form shell.
 *
 * The two shells exist to give the merchant one authoring page over two form
 * libraries, so the guarantees are asserted the same way in both: by rendering
 * a real form, typing into it, and reading back what is on screen afterwards.
 * A shared assertion of the *code* would only prove the two files look alike.
 */

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  note: z.string(),
})

type Values = z.infer<typeof schema>

const navigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate }
})

const inputValue = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

interface Widget {
  id: string
  name: string
  note: string
}

function Harness({
  onSave,
  recordId,
  record,
}: {
  onSave: (values: Values) => Promise<{ id?: string } | void>
  recordId?: string
  record?: Widget
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', note: '' },
  })

  return (
    <MemoryRouter>
      <ResourceFormPageRhf<Values, Widget>
        noun="Widget"
        listPath="/widgets"
        recordId={recordId}
        form={form}
        record={record}
        toValues={(w) => ({ name: w.name, note: w.note })}
        onSave={onSave}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input aria-label="Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Input aria-label="Note" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </ResourceFormPageRhf>
    </MemoryRouter>
  )
}

describe('ResourceFormPageRhf', () => {
  it('leaves everything the merchant entered on the page when a save is refused', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('A widget named "Bolt" already exists'))

    render(<Harness onSave={onSave} />)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.type(screen.getByLabelText('Note'), 'Half an hour of typing')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

    // Nothing was reset, re-fetched over, or navigated away from.
    await waitFor(() => {
      expect(inputValue('Name')).toBe('Bolt')
      expect(inputValue('Note')).toBe('Half an hour of typing')
    })
  })

  it('shows the server’s own reason, not a generic failure', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('A widget named "Bolt" already exists'))

    render(<Harness onSave={onSave} />)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeDefined())
  })

  it('does not call the server at all when a required field is empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<Harness onSave={onSave} />)

    await user.type(screen.getByLabelText('Note'), 'no name given')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(screen.getByText('Name is required')).toBeDefined())
    expect(onSave).not.toHaveBeenCalled()
    expect(inputValue('Note')).toBe('no name given')
  })

  it('returns to the list on "Save and return"', async () => {
    const user = userEvent.setup()
    navigate.mockClear()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<Harness onSave={onSave} />)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and return/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/widgets'))
  })

  it('turns a create into the edit form for what was just created', async () => {
    const user = userEvent.setup()
    navigate.mockClear()
    const onSave = vi.fn().mockResolvedValue({ id: 'w-1' })

    render(<Harness onSave={onSave} />)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    // Without this, pressing Save again would create a second widget.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/widgets/w-1', { replace: true }),
    )
  })

  it('re-syncs when the record it is editing changes', async () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <Harness onSave={onSave} recordId="w-1" record={{ id: 'w-1', name: 'Bolt', note: 'first' }} />,
    )

    await waitFor(() => expect(inputValue('Name')).toBe('Bolt'))

    // Editing one record then another keeps this component mounted — an overlay
    // got the reset for free by unmounting on close.
    rerender(
      <Harness onSave={onSave} recordId="w-2" record={{ id: 'w-2', name: 'Nut', note: 'second' }} />,
    )

    await waitFor(() => {
      expect(inputValue('Name')).toBe('Nut')
      expect(inputValue('Note')).toBe('second')
    })
  })

  it('empties the form when the same component becomes a create page', async () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <Harness onSave={onSave} recordId="w-1" record={{ id: 'w-1', name: 'Bolt', note: 'first' }} />,
    )

    await waitFor(() => expect(inputValue('Name')).toBe('Bolt'))

    // `/:id` and `/new` are deliberately one component, so going from an edit
    // URL to the create URL must not leave the edited record in the fields —
    // saving would then create a copy of it.
    rerender(<Harness onSave={onSave} />)

    await waitFor(() => {
      expect(inputValue('Name')).toBe('')
      expect(inputValue('Note')).toBe('')
    })
  })

  it('does not re-navigate when saving an existing record and staying', async () => {
    const user = userEvent.setup()
    navigate.mockClear()
    const onSave = vi.fn().mockResolvedValue({ id: 'w-1' })

    render(<Harness onSave={onSave} recordId="w-1" />)

    await user.type(screen.getByLabelText('Name'), 'Bolt')
    await user.click(screen.getByRole('button', { name: /save and continue editing/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(navigate).not.toHaveBeenCalled()
  })
})
