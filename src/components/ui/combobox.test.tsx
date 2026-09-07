import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'

/**
 * Asserts `admin-shell` — "Long option lists are narrowable by typing".
 *
 * The three empty states are tested separately on purpose: the product form's
 * own comments record that a merchant reading antd's empty dropdown could not
 * tell "still loading" from "there are none", and read the wrong one.
 */

const BRANDS: ComboboxOption[] = [
  { value: 'a', label: 'Anker' },
  { value: 'b', label: 'Baseus' },
  { value: 'c', label: 'Belkin' },
]

function Harness({
  options = BRANDS,
  initial = null,
  ...rest
}: Partial<React.ComponentProps<typeof Combobox>> & { initial?: string | null }) {
  const [value, setValue] = React.useState<string | null>(initial)
  return (
    <Combobox
      aria-label="Brand"
      placeholder="Select a brand"
      options={options}
      value={value}
      onValueChange={setValue}
      {...rest}
    />
  )
}

/** The listbox's options, in render order. */
const optionLabels = () => screen.getAllByRole('option').map((o) => o.textContent)

describe('Combobox', () => {
  it('exposes exactly one combobox, named once', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getAllByRole('combobox')).toHaveLength(1)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))

    // Opening must not introduce a second control with the same name.
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('narrows the options to what was typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    expect(optionLabels()).toHaveLength(3)

    await user.keyboard('be')

    await waitFor(() => expect(optionLabels()).toEqual(['Belkin']))
  })

  it('selects with the arrow keys and Enter', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onValueChange={onValueChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    // Opens on the selected option — nothing selected here, so the first.
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('b'))
  })

  it('tracks the highlight with aria-activedescendant, leaving the caret alone', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))

    const field = screen.getByRole('textbox', { name: 'Search' })
    expect(field).toBe(document.activeElement)

    const first = field.getAttribute('aria-activedescendant')
    expect(first).toBeTruthy()

    await user.keyboard('{ArrowDown}')

    await waitFor(() => expect(field.getAttribute('aria-activedescendant')).not.toBe(first))
    // The arrows moved the highlight, not the focus.
    expect(field).toBe(document.activeElement)
  })

  it('wraps the highlight around the ends of the list', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onValueChange={onValueChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    // Up from the first option lands on the last.
    await user.keyboard('{ArrowUp}{Enter}')

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('c'))
  })

  it('closes on Escape without changing the selection', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="a" onValueChange={onValueChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Brand' }).textContent).toContain('Anker')
  })

  it('says nothing matched, distinctly from saying the list is empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    await user.keyboard('zzzz')

    await waitFor(() => expect(screen.getByText('Nothing matches what you typed')).not.toBeNull())
    expect(screen.queryByText('There are none yet')).toBeNull()
  })

  it('says there are none when the list is genuinely empty', async () => {
    const user = userEvent.setup()
    render(<Harness options={[]} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))

    await waitFor(() => expect(screen.getByText('There are none yet')).not.toBeNull())
    expect(screen.queryByText('Nothing matches what you typed')).toBeNull()
  })

  it('says the options are still arriving rather than showing an empty list', async () => {
    const user = userEvent.setup()
    render(<Harness options={[]} loading />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))

    await waitFor(() => expect(screen.getByText('Loading options…')).not.toBeNull())
    expect(screen.queryByText('There are none yet')).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('clears back to no selection when clearable', async () => {
    const user = userEvent.setup()
    render(<Harness initial="a" clearable />)

    expect(screen.getByRole('combobox', { name: 'Brand' }).textContent).toContain('Anker')

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Brand' }).textContent).toContain('Select a brand'),
    )
  })

  it('offers no clear control when nothing is selected', () => {
    render(<Harness clearable />)
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })

  /*
   * `admin-shell` — "An option list may offer an action below its options".
   * The action is a sibling of the list, not a member of it: as a member it
   * would shift the highlight indices, be committed by Enter as a value, and
   * be filtered away by the search at the one moment it is wanted.
   */
  it('keeps the create action out of the arrow keys and out of Enter', async () => {
    const onSelect = vi.fn()
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Harness
        onValueChange={onValueChange}
        createAction={{ label: 'Add brand', onSelect }}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    // The action is offered, and is not one of the options.
    expect(screen.getByRole('button', { name: 'Add brand' })).not.toBeNull()
    expect(optionLabels()).toEqual(['Anker', 'Baseus', 'Belkin'])

    // Past the end of a three-option list and around.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    // A value, never the action.
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('a'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('offers the create action when nothing matched what was typed', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness createAction={{ label: 'Add brand', onSelect }} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    await user.keyboard('zzzz')

    await waitFor(() => expect(screen.getByText('Nothing matches what you typed')).not.toBeNull())

    // The moment it exists for: searched, not found, create it from here.
    await user.click(screen.getByRole('button', { name: 'Add brand' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('leaves filtering to the caller when asked', async () => {
    const onSearchChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness filter={false} onSearchChange={onSearchChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Brand' }))
    await user.keyboard('zzzz')

    // The server owns the list, so a local miss must not hide what it returned.
    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('zzzz'))
    expect(optionLabels()).toHaveLength(3)
  })
})
