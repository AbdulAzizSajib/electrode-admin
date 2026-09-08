/**
 * Contract tests for the barcode renderer.
 *
 * The encoder's own correctness is proven in code128.test.ts. What matters here
 * is what reaches the page: that the bars are SVG rather than a rasterised
 * canvas, that rendering one contacts nothing, and that an unencodable value
 * still prints the number rather than a wrong barcode.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Barcode } from './barcode'
import { encodeCode128B, QUIET_ZONE_MODULES } from './code128'

describe('Barcode', () => {
  it('renders bars as SVG rects, not a canvas', () => {
    // Canvas would resample the bars at print dpi and break scanning — see
    // design.md Decision 2.
    const { container } = render(<Barcode value="ORD-20260908-A1B2C3" />)

    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(1)
  })

  it('emits one rect per bar, plus the white quiet-zone background', () => {
    const value = 'ORD-20260908-A1B2C3'
    const encoded = encodeCode128B(value)!
    // Runs alternate bar-first, so bars are the even indices.
    const expectedBars = encoded.runs.filter((_, i) => i % 2 === 0).length

    const { container } = render(<Barcode value={value} />)
    expect(container.querySelectorAll('rect')).toHaveLength(expectedBars + 1)
  })

  it('reserves a quiet zone on both sides', () => {
    const value = 'ORD-20260908-A1B2C3'
    const encoded = encodeCode128B(value)!
    const { container } = render(<Barcode value={value} />)

    const svg = container.querySelector('svg')!
    const [, , width] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    expect(width).toBe(encoded.modules + QUIET_ZONE_MODULES * 2)

    // The first bar starts after the leading quiet zone, never at x=0.
    const firstBar = container.querySelectorAll('rect')[1]
    expect(Number(firstBar.getAttribute('x'))).toBe(QUIET_ZONE_MODULES)
  })

  it('prints the value in text beneath the bars', () => {
    const { getByText } = render(<Barcode value="ORD-20260908-A1B2C3" />)
    expect(getByText('ORD-20260908-A1B2C3')).toBeTruthy()
  })

  it('degrades to text alone when the value cannot be encoded', () => {
    // Strictly better than a truncated barcode, which would misroute silently.
    const { container, getByText } = render(<Barcode value="ORD-বাংলা" />)

    expect(container.querySelector('svg')).toBeNull()
    expect(getByText('ORD-বাংলা')).toBeTruthy()
  })

  it('contacts no network when rendering', () => {
    // A label must print on a bench with no internet.
    const fetchSpy = vi.fn()
    const original = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
    try {
      render(<Barcode value="ORD-20260908-A1B2C3" />)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = original
    }
  })

  it('sizes bars in millimetres so print dpi does not change the ratios', () => {
    const { container } = render(<Barcode value="ORD-1" heightMm={20} moduleMm={0.5} />)
    const svg = container.querySelector('svg')!

    expect(svg.getAttribute('height')).toBe('20mm')
    expect(svg.getAttribute('width')).toMatch(/mm$/)
  })
})
