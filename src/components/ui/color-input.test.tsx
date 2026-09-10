import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorInput, normaliseHex } from '@/components/ui/color-input'

/**
 * Asserts `admin-shell` — "Colour values are entered and shown as a hex code".
 *
 * The unset assertions are the ones that matter. A native `<input type="color">`
 * reports `#000000` when it has never been touched, so a component that simply
 * forwarded its value would save every untouched swatch as black — and nothing
 * on screen would say so.
 *
 * The picker is driven with `fireEvent.change` rather than `userEvent`: there is
 * no colour dialog in jsdom to click through, and the change event is what a
 * real pick ultimately dispatches.
 */

function Harness({
  initial,
  onChange = () => {},
}: {
  initial?: string
  onChange?: (value: string | undefined) => void
}) {
  const [value, setValue] = React.useState<string | undefined>(initial)

  return (
    <ColorInput
      aria-label="Swatch"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const picker = () => screen.getByLabelText('Pick a colour') as HTMLInputElement
const text = () => screen.getByLabelText('Swatch') as HTMLInputElement

describe('normaliseHex', () => {
  it('expands three digits and lowercases, so one colour has one spelling', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc')
    expect(normaliseHex('abc')).toBe('#aabbcc')
    expect(normaliseHex('#AABBCC')).toBe('#aabbcc')
  })

  it('rejects anything that is not yet a colour', () => {
    expect(normaliseHex('#f')).toBeNull()
    expect(normaliseHex('#gggggg')).toBeNull()
    expect(normaliseHex('')).toBeNull()
  })
})

describe('ColorInput', () => {
  it('shows the hex code when a colour is picked', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.change(picker(), { target: { value: '#ff0000' } })

    expect(onChange).toHaveBeenCalledWith('#ff0000')
    expect(text().value).toBe('#ff0000')
  })

  it('updates the swatch when a hex code is typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(text(), '#00ff00')

    expect(onChange).toHaveBeenLastCalledWith('#00ff00')
    expect(picker().value).toBe('#00ff00')
  })

  it('accepts a three-digit code and stores it expanded', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(text(), '#abc')

    expect(onChange).toHaveBeenLastCalledWith('#aabbcc')
    expect(picker().value).toBe('#aabbcc')
  })

  it('reports nothing while a code is still half-typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(text(), '#ff')

    // "#f" and "#ff" are not colours yet. Reporting either would clear the
    // swatch on the way to a valid code.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('presents as unset rather than as black when never set', () => {
    render(<Harness />)

    expect(text().value).toBe('')
    expect(text().getAttribute('placeholder')).toBe('Not set')
  })

  it('saves as unset when never set', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    // Nothing was touched, so nothing was reported — the field is absent from
    // the payload rather than present as #000000.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears back to unset when the code is emptied', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="#ff0000" onChange={onChange} />)

    await user.clear(text())

    expect(onChange).toHaveBeenLastCalledWith(undefined)
    expect(text().value).toBe('')
  })

  it('shows a loaded colour on both controls', () => {
    render(<Harness initial="#123456" />)

    expect(text().value).toBe('#123456')
    expect(picker().value).toBe('#123456')
  })
})
