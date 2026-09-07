import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelect } from '@/components/ui/multi-select'
import type { ComboboxOption } from '@/components/ui/combobox'

/**
 * Asserts `admin-shell` — "Multi-value fields show and remove selections
 * individually".
 */

const COLLECTIONS: ComboboxOption[] = [
  { value: 'a', label: 'Summer sale' },
  { value: 'b', label: 'New arrivals' },
  { value: 'c', label: 'Clearance' },
]

function Harness({ initial = [] as string[], ...rest }: { initial?: string[] } & Record<string, unknown>) {
  const [value, setValue] = React.useState<string[]>(initial)
  return (
    <MultiSelect
      aria-label="Collections"
      placeholder="None"
      options={COLLECTIONS}
      value={value}
      onValueChange={setValue}
      {...rest}
    />
  )
}

const chipLabels = () =>
  screen
    .getAllByRole('button', { name: /^Remove / })
    .map((b) => b.getAttribute('aria-label')?.replace('Remove ', ''))

describe('MultiSelect', () => {
  it('shows each of several selections separately', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Collections' }))
    await user.click(screen.getByRole('option', { name: 'Summer sale' }))
    await user.click(screen.getByRole('option', { name: 'New arrivals' }))
    await user.click(screen.getByRole('option', { name: 'Clearance' }))

    await waitFor(() => expect(chipLabels()).toEqual(['Summer sale', 'New arrivals', 'Clearance']))
  })

  it('stays open while several are picked', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Collections' }))
    await user.click(screen.getByRole('option', { name: 'Summer sale' }))

    // Still open — picking three should not mean opening the list three times.
    expect(screen.getByRole('listbox')).not.toBeNull()
  })

  it('removes one selection without disturbing the others', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['a', 'b', 'c']} />)

    expect(chipLabels()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Remove New arrivals' }))

    await waitFor(() => expect(chipLabels()).toEqual(['Summer sale', 'Clearance']))
  })

  it('shows the placeholder when nothing is selected', () => {
    render(<Harness />)

    expect(screen.getByRole('combobox', { name: 'Collections' }).textContent).toContain('None')
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })

  it('reports how many are selected once there are some', async () => {
    render(<Harness initial={['a', 'c']} />)

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Collections' }).textContent).toContain('2 selected'),
    )
  })

  it('toggles a selection off from the list', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['a']} />)

    await user.click(screen.getByRole('combobox', { name: 'Collections' }))
    expect(screen.getByRole('option', { name: 'Summer sale' }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('option', { name: 'Summer sale' }))

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Summer sale' }).getAttribute('aria-selected')).toBe('false'),
    )
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })

  it('narrows the options to what was typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Collections' }))
    await user.keyboard('clear')

    await waitFor(() =>
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Clearance']),
    )
  })

  it('marks the list as accepting several values', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Collections' }))

    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true')
  })
})
