import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariantPicker } from '@/features/ui/home-slider/variant-picker'
import { heroSlots } from '@/features/ui/home-slider/hero-slots'
import { HERO_VARIANT_OPTIONS } from '@/lib/api/store-settings'

/*
 * The picker went out once looking correct and behaving as though it were
 * inert. Two causes, both invisible in a screenshot: it was disabled from the
 * SHARED settings mutation's `isPending`, so any other editor's save killed it
 * and nothing about the card said why; and the cards did not stretch to their
 * grid row, so a card shorter than its neighbours left a band of dead space
 * inside the cell that swallowed clicks.
 *
 * These tests pin the behaviour rather than the styling, since the styling is
 * what was wrong both times.
 */
describe('VariantPicker', () => {
  it('reports the layout a merchant clicks', async () => {
    const onChange = vi.fn()
    render(<VariantPicker value="SPLIT_THREE" onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Full-width slider' }))

    expect(onChange).toHaveBeenCalledWith('FULL_SLIDER')
  })

  it('offers every layout the panel knows about', () => {
    render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)

    expect(screen.getAllByRole('radio')).toHaveLength(HERO_VARIANT_OPTIONS.length)
  })

  it('stays usable while another layout is saving', () => {
    // The regression. `saving` names ONE layout, so a save in flight disables
    // only that card — a merchant who clicked the wrong one can correct it
    // without waiting for a round trip they have no reason to expect.
    render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} saving="SLIDER_STACK" />)

    // `disabled` read off the element, not via jest-dom — this suite has no
    // custom matchers (see src/test-setup.ts, which stubs browser APIs only).
    const disabledOf = (name: string) =>
      (screen.getByRole('radio', { name }) as HTMLButtonElement).disabled

    expect(disabledOf('Slider above three tiles')).toBe(true)
    expect(disabledOf('Slider with three tiles')).toBe(false)
    expect(disabledOf('Full-width slider')).toBe(false)
  })

  it('is fully live when nothing is saving', () => {
    render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)

    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLButtonElement).disabled).toBe(false)
    }
  })

  it('prints each layout artwork sizes in whole pixels', () => {
    // So a merchant can tell, before switching, whether the artwork they
    // already have fits the layout they are considering.
    render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)

    for (const option of HERO_VARIANT_OPTIONS) {
      const card = screen.getByRole('radio', { name: option.label })

      for (const slot of heroSlots(option.value)) {
        expect(card.textContent).toContain(
          `${slot.recommended.width} × ${slot.recommended.height}`,
        )
      }
    }
  })

  /*
   * Every card renders identically except for its content.
   *
   * One card rendered visibly taller than the other three while the markup for
   * every card was byte-identical. The cause was `h-full` on the card: that is
   * `height: 100%`, and a percentage height on a GRID ITEM resolves against the
   * row height, which the items' own content is what determines. Circular, and
   * browsers resolve it inconsistently.
   *
   * A grid item already gets `align-self: stretch`, so it fills the row with no
   * height declaration at all. These pin the absence, because the symptom was
   * invisible to every other test in this file — the click handlers, the
   * labels and the sizes were all correct while the picker looked broken.
   */
  it('gives every card the same classes apart from its selected state', () => {
    const { container } = render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)
    const cards = Array.from(container.querySelectorAll('button'))

    // Strip the two state-dependent groups, leaving the structural classes.
    const structural = (el: Element) =>
      (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => !c.startsWith('border-') && !c.startsWith('bg-') && !c.startsWith('hover:'))
        .sort()
        .join(' ')

    const first = structural(cards[0])
    for (const card of cards) expect(structural(card)).toBe(first)
  })

  it('sizes no card by a percentage height', () => {
    const { container } = render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)

    for (const card of container.querySelectorAll('button')) {
      const classes = (card.getAttribute('class') ?? '').split(/\s+/)

      // `h-full` was the defect. `min-h-full` and `h-[100%]` are the same bug.
      expect(classes).not.toContain('h-full')
      expect(classes).not.toContain('min-h-full')
      expect(classes.filter((c) => /^h-\[.*%\]$/.test(c))).toEqual([])
    }
  })

  it('draws every diagram on one viewBox, so none is taller', () => {
    const { container } = render(<VariantPicker value="SPLIT_THREE" onChange={() => {}} />)
    const boxes = Array.from(container.querySelectorAll('svg')).map((s) =>
      s.getAttribute('viewBox'),
    )

    expect(boxes).toHaveLength(HERO_VARIANT_OPTIONS.length)
    expect(new Set(boxes).size).toBe(1)
  })
})
