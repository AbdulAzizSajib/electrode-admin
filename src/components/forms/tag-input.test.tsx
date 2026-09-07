import * as React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from '@/components/forms/tag-input'

/**
 * Asserts `specs/catalog-management` — "Keywords are reused rather than
 * reinvented".
 *
 * The suggestion query is stubbed rather than served through a QueryClient: the
 * requirement is about what the merchant can do with the suggestions, and a
 * real fetch would only add latency to assertions about de-duplication.
 */

const suggestions = vi.hoisted(() => ({ current: [] as { id: string; name: string }[], fetching: false }))

vi.mock('@/lib/api/tags', () => ({
  useTagSuggestions: (term: string) => ({
    data: term.trim() ? suggestions.current : [],
    isFetching: suggestions.fetching,
  }),
}))

function Harness({ initial = [] as string[] }: { initial?: string[] }) {
  const [value, setValue] = React.useState<string[]>(initial)
  return <TagInput aria-label="Keywords" value={value} onChange={setValue} />
}

const chips = () =>
  screen.queryAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label')?.replace('Remove ', ''))

const field = () => screen.getByRole('combobox', { name: 'Keywords' })

beforeEach(() => {
  suggestions.current = []
  suggestions.fetching = false
})

describe('TagInput', () => {
  it('offers keywords the shop already uses', async () => {
    suggestions.current = [
      { id: '1', name: 'wireless' },
      { id: '2', name: 'wired' },
    ]
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('wir')

    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['wireless', 'wired']))
  })

  it('does not offer a keyword already on this product', async () => {
    suggestions.current = [
      { id: '1', name: 'wireless' },
      { id: '2', name: 'wired' },
    ]
    const user = userEvent.setup()
    render(<Harness initial={['wireless']} />)

    await user.click(field())
    await user.keyboard('wir')

    // Offering it would invite a click that does nothing.
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['wired']))
  })

  it('adds a suggestion when it is picked', async () => {
    suggestions.current = [{ id: '1', name: 'wireless' }]
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('wir')
    await user.click(await screen.findByRole('option', { name: 'wireless' }))

    await waitFor(() => expect(chips()).toEqual(['wireless']))
  })

  it('adds a keyword matching no suggestion, as typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('Handcrafted{Enter}')

    await waitFor(() => expect(chips()).toEqual(['Handcrafted']))
  })

  it('commits on a comma as well as Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('one,')
    await user.keyboard('two,')

    await waitFor(() => expect(chips()).toEqual(['one', 'two']))
  })

  it('collapses a case-insensitive repeat, keeping the first spelling', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['wireless']} />)

    await user.click(field())
    await user.keyboard('Wireless{Enter}')

    await waitFor(() => expect(chips()).toEqual(['wireless']))
  })

  it('removes one keyword without touching one that contains it', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['less', 'wireless']} />)

    await user.click(screen.getByRole('button', { name: 'Remove less' }))

    // The reference panel's substring de-duplication removed both.
    await waitFor(() => expect(chips()).toEqual(['wireless']))
  })

  it('says a typed keyword matches nothing, and that Enter will add it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('zzz')

    await waitFor(() =>
      expect(screen.getByText('No matching keyword — press Enter to add it')).not.toBeNull(),
    )
  })

  it('says it is searching while suggestions are still arriving', async () => {
    suggestions.fetching = true
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('wir')

    await waitFor(() => expect(screen.getByText('Searching…')).not.toBeNull())
  })

  it('ignores a blank entry', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(field())
    await user.keyboard('   {Enter}')

    expect(chips()).toEqual([])
  })

  it('removes the last keyword on Backspace only when the field is empty', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['one', 'two']} />)

    await user.click(field())
    await user.keyboard('abc')
    await user.keyboard('{Backspace}')

    // Ate a typed character, not a chip.
    expect(chips()).toEqual(['one', 'two'])

    await user.keyboard('{Backspace}{Backspace}{Backspace}')
    await waitFor(() => expect(chips()).toEqual(['one']))
  })
})
