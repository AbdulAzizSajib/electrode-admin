import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardColorField } from '@/features/ui/site-settings/site-settings-page'
import { contrastRatio } from '@/features/ui/site-settings/contrast'

/**
 * Asserts `storefront-cms/theming` — the optional card colour's two transitions
 * in the editor, and the contrast the "Card text on card" warning reads.
 *
 * The UNSET state matters as much as the colour: "Use default" must produce
 * `null`, because the save sends the draft as is and the backend reads `null`
 * as "clear" — an omitted key would keep the stored colour, so the merchant
 * could never get back to white product cards and grey category tiles.
 *
 * See server/openspec/changes/add-card-background-theme-color.
 */

describe('CardColorField', () => {
  it('offers to choose a colour when unset, starting from white', async () => {
    const onChange = vi.fn()
    render(<CardColorField value={undefined} onChange={onChange} />)

    expect(screen.getByText('Default')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Choose a colour' }))

    expect(onChange).toHaveBeenCalledWith('#ffffff')
  })

  it('treats a stored null the same as unset', () => {
    render(<CardColorField value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Choose a colour' })).not.toBeNull()
  })

  it('returns to the default by setting null', async () => {
    const onChange = vi.fn()
    render(<CardColorField value="#fff9f2" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Use default' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('card text contrast', () => {
  // gray-900, the colour card titles are fixed to on the storefront.
  const CARD_TEXT = '#111827'

  it('warns for a dark card colour', () => {
    expect(contrastRatio('#3D2314', CARD_TEXT)!).toBeLessThan(4.5)
  })

  it('passes for a light cream card colour', () => {
    expect(contrastRatio('#FFF9F2', CARD_TEXT)!).toBeGreaterThanOrEqual(4.5)
  })
})
