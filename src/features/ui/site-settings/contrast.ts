/**
 * WCAG contrast ratio, for the advisory readability note on Site Settings.
 *
 * Advisory is the point: a merchant owns their brand, and a hard gate on
 * contrast would be the wrong call. This exists so a merchant who picks white
 * on white finds out here rather than from a customer.
 *
 * Kept separate from the page component so a file does not export both a
 * component and plain functions, which breaks fast refresh — the same reason
 * `settings-editor-utils.tsx` is split from `settings-editor.tsx`.
 */

/** `#rgb` and `#rrggbb`, matching the backend's accepted forms. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Returns `[r, g, b]` in 0–255, or null when the input is not a hex colour. */
function toRgb(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null

  const raw = hex.slice(1)
  // `#abc` is shorthand for `#aabbcc`.
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Contrast ratio between two hex colours, 1:1 to 21:1. Null when either value
 * is not a colour we can read — the merchant is mid-edit, not wrong yet.
 */
export function contrastRatio(a: string, b: string): number | null {
  const rgbA = toRgb(a)
  const rgbB = toRgb(b)
  if (!rgbA || !rgbB) return null

  const lumA = luminance(rgbA)
  const lumB = luminance(rgbB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)

  return (lighter + 0.05) / (darker + 0.05)
}
