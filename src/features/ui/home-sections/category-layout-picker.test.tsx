import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryLayoutPicker } from '@/features/ui/home-sections/category-layout-picker'
import { FEATURED_CATEGORIES_LAYOUT_OPTIONS } from '@/lib/api/store-settings'

/*
 * The second picker over the shared `LayoutPicker` shell. These pin the
 * behaviour the hero's own tests pin — a click reports the right option, every
 * card is free of the percentage height that made one card render taller than
 * the rest — so a regression in the shell fails in both places rather than
 * in whichever one someone happens to run.
 */
describe('CategoryLayoutPicker', () => {
  it('offers both layouts as radios, named for a merchant', () => {
    render(<CategoryLayoutPicker value="GRID" onChange={() => {}} />)

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(FEATURED_CATEGORIES_LAYOUT_OPTIONS.length)
    expect(screen.getByRole('radio', { name: 'Grid' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Slider' })).toBeTruthy()
  })

  it('reports the layout a merchant clicks', async () => {
    const onChange = vi.fn()
    render(<CategoryLayoutPicker value="GRID" onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Slider' }))

    expect(onChange).toHaveBeenCalledWith('SLIDER')
  })

  it('shows the current layout selected', () => {
    render(<CategoryLayoutPicker value="SLIDER" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: 'Slider' }).getAttribute('data-state')).toBe('checked')
    expect(screen.getByRole('radio', { name: 'Grid' }).getAttribute('data-state')).toBe('unchecked')
  })

  it('sizes no card by a percentage height', () => {
    const { container } = render(<CategoryLayoutPicker value="GRID" onChange={() => {}} />)

    for (const card of container.querySelectorAll('button')) {
      const classes = (card.getAttribute('class') ?? '').split(/\s+/)
      expect(classes).not.toContain('h-full')
      expect(classes).not.toContain('min-h-full')
      expect(classes.filter((c) => /^h-\[.*%\]$/.test(c))).toEqual([])
    }
  })

  it('draws both diagrams on one viewBox, so neither card is taller', () => {
    const { container } = render(<CategoryLayoutPicker value="GRID" onChange={() => {}} />)
    const boxes = Array.from(container.querySelectorAll('svg')).map((s) => s.getAttribute('viewBox'))

    expect(boxes).toHaveLength(2)
    expect(new Set(boxes).size).toBe(1)
  })
})
