import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormArrayMessage,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

/**
 * Asserts `admin-shell` — "A validation failure belonging to a whole group is
 * reported against the group".
 *
 * This is the assertion the whole antd removal hangs on. `Form.List rules` plus
 * `Form.ErrorList` reported group-level failures for free; zod plus
 * react-hook-form raises the issue but renders nothing for it, so without
 * `FormArrayMessage` a save is silently refused — the merchant presses Save,
 * nothing happens, and no message anywhere says why.
 *
 * The rules mirror the two the attribute editor actually carries.
 */

const schema = z.object({
  values: z
    .array(z.object({ label: z.string().min(1, 'A value needs a label') }))
    .superRefine((rows, ctx) => {
      const labels = rows.map((row) => row.label.trim().toLowerCase()).filter(Boolean)

      if (labels.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'An attribute needs at least one value' })
      }
      if (new Set(labels).size !== labels.length) {
        ctx.addIssue({ code: 'custom', message: 'Two values read as the same choice' })
      }
    }),
})

type Values = z.infer<typeof schema>

function Harness({
  initial,
  onValid = () => {},
}: {
  initial: Values['values']
  onValid?: (values: Values) => void
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { values: initial },
  })
  const { fields, remove } = useFieldArray({ control: form.control, name: 'values' })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onValid)}>
        {fields.map((field, index) => (
          <div key={field.id}>
            <FormField
              control={form.control}
              name={`values.${index}.label`}
              render={({ field: input }) => (
                <FormItem>
                  <FormControl>
                    <Input aria-label={`Value ${index + 1}`} {...input} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type="button" onClick={() => remove(index)}>
              Remove {index + 1}
            </button>
          </div>
        ))}

        <FormArrayMessage name="values" />
        <button type="submit">Save</button>
      </form>
    </Form>
  )
}

const save = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save' }))

describe('FormArrayMessage', () => {
  it('renders a group-level issue that belongs to no single field', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }, { label: 'Red' }]} />)

    await save(user)

    await waitFor(() =>
      expect(screen.getByText('Two values read as the same choice')).not.toBeNull(),
    )
  })

  it('reports an empty group, where there is not even a row to hang the message on', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }]} />)

    await user.click(screen.getByRole('button', { name: 'Remove 1' }))
    await save(user)

    await waitFor(() =>
      expect(screen.getByText('An attribute needs at least one value')).not.toBeNull(),
    )
  })

  it('blocks the save while the group rule is broken', async () => {
    const onValid = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }, { label: 'red' }]} />)

    await save(user)

    await waitFor(() =>
      expect(screen.getByText('Two values read as the same choice')).not.toBeNull(),
    )
    expect(onValid).not.toHaveBeenCalled()
  })

  it('renders nothing when the group is valid', async () => {
    const onValid = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }, { label: 'Blue' }]} onValid={onValid} />)

    await save(user)

    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(screen.queryByText('Two values read as the same choice')).toBeNull()
    expect(screen.queryByText('An attribute needs at least one value')).toBeNull()
  })

  it('clears the group message once the collision is resolved', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }, { label: 'Red' }]} />)

    await save(user)
    await waitFor(() =>
      expect(screen.getByText('Two values read as the same choice')).not.toBeNull(),
    )

    await user.clear(screen.getByLabelText('Value 2'))
    await user.type(screen.getByLabelText('Value 2'), 'Blue')
    await save(user)

    await waitFor(() =>
      expect(screen.queryByText('Two values read as the same choice')).toBeNull(),
    )
  })

  /*
   * zod 4 runs an array's `superRefine` even when one of its elements failed,
   * so a single blank row genuinely breaks two rules at once: that row has no
   * label, and the group is left with no values. Both are true and both must
   * be visible — a field error must not hide the group error, and the group
   * error must not swallow the field's.
   */
  it('reports a field-level and a group-level failure side by side', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ label: '' }]} />)

    await save(user)

    // The row's own message renders through `FormMessage`, inside the row...
    await waitFor(() => expect(screen.getByText('A value needs a label')).not.toBeNull())
    // ...and the group's renders through `FormArrayMessage`, at the group.
    expect(screen.getByText('An attribute needs at least one value')).not.toBeNull()
  })

  it('shows only the field error when the group itself is fine', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ label: 'Red' }, { label: '' }]} />)

    await save(user)

    // One row is blank, but "Red" still counts, so the group has a value and
    // no two labels collide — only the row is at fault.
    await waitFor(() => expect(screen.getByText('A value needs a label')).not.toBeNull())
    expect(screen.queryByText('An attribute needs at least one value')).toBeNull()
    expect(screen.queryByText('Two values read as the same choice')).toBeNull()
  })
})
