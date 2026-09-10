import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { Input } from '@/components/ui/input'

/**
 * A colour field — the replacement for antd's `ColorPicker showText format="hex"`.
 *
 * Two controls over one value: a native `<input type="color">` for picking, and
 * a text box showing the same colour as a hex code. The text box is the point.
 * A merchant matching a swatch to a brand needs to read the code off, paste one
 * in from a brand sheet, and be sure the two agree — a saturation canvas alone
 * cannot do any of that.
 *
 * The native control has no empty state: never touched, it reports `#000000`,
 * which is indistinguishable from someone deliberately choosing black. So the
 * value here is `string | undefined`, the native input is fed a placeholder
 * colour it never reports back on its own, and an unset field is covered by a
 * hatched overlay so it does not read as "black is selected".
 *
 * Typing is committed only when it parses. Mid-edit text like `#f` would
 * otherwise clear the swatch on every keystroke, so the box keeps its own draft
 * and reports upward when the draft is a colour — or when it is emptied, which
 * is how a colour is removed.
 *
 * See openspec/changes/remove-antd-from-admin, design.md Decision 5, and
 * `specs/admin-shell` — "Colour values are entered and shown as a hex code".
 */

/** `#abc`, `abc`, `#aabbcc` and `aabbcc` all parse; anything else is still being typed. */
const HEX = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Shown by the native control while the field is unset; never reported upward. */
const PLACEHOLDER_COLOR = '#000000'

/** Expands `#abc` to `#aabbcc` and lowercases, so two spellings of one colour compare equal. */
export function normaliseHex(raw: string): string | null {
  const trimmed = raw.trim()
  if (!HEX.test(trimmed)) return null

  const digits = trimmed.replace('#', '').toLowerCase()
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits

  return `#${full}`
}

export interface ColorInputProps {
  /** `undefined` means no colour has been chosen — distinct from black. */
  value?: string | null
  onChange: (value: string | undefined) => void
  onBlur?: () => void
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  ({ value, onChange, onBlur, disabled, id, className, ...aria }, ref) => {
    const committed = value ?? undefined

    // The draft the merchant is typing. Resynced from `value` whenever the
    // value changes from outside — a record loading, or the picker being used —
    // but left alone while they type, so a half-finished code is not rewritten
    // under the cursor.
    //
    // Adjusting state during render rather than in an effect: the alternative
    // paints one frame of the stale colour every time a record loads. React
    // documents this shape for exactly that reason.
    const [draft, setDraft] = React.useState(committed ?? '')
    const [lastCommitted, setLastCommitted] = React.useState(committed)

    if (lastCommitted !== committed) {
      setLastCommitted(committed)
      // Only overwrite the draft if it does not already spell this colour, so
      // `#ABC` is not rewritten to `#aabbcc` under the cursor.
      if (normaliseHex(draft) !== committed) setDraft(committed ?? '')
    }

    const handleText = (raw: string) => {
      setDraft(raw)

      if (raw.trim() === '') {
        onChange(undefined)
        return
      }

      const parsed = normaliseHex(raw)
      // Not a colour yet — they are still typing. The last committed value
      // stands until it is.
      if (parsed) onChange(parsed)
    }

    const handlePick = (raw: string) => {
      const parsed = normaliseHex(raw)
      if (!parsed) return
      setDraft(parsed)
      setLastCommitted(parsed)
      onChange(parsed)
    }

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative size-8 shrink-0">
          <input
            type="color"
            aria-label="Pick a colour"
            disabled={disabled}
            value={committed ?? PLACEHOLDER_COLOR}
            onChange={(event) => handlePick(event.target.value)}
            className="size-8 cursor-pointer rounded-md border border-input bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {/* Covers the control's `#000000` fallback so an untouched field does
              not advertise a colour nobody chose. Clicks pass through. */}
          {committed === undefined && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-md border border-input bg-background bg-[linear-gradient(135deg,transparent_45%,var(--color-border)_45%,var(--color-border)_55%,transparent_55%)]"
            />
          )}
        </div>

        <Input
          ref={ref}
          id={id}
          value={draft}
          disabled={disabled}
          onChange={(event) => handleText(event.target.value)}
          onBlur={onBlur}
          placeholder="Not set"
          spellCheck={false}
          autoComplete="off"
          className="w-28 font-mono uppercase"
          {...aria}
        />
      </div>
    )
  },
)
ColorInput.displayName = 'ColorInput'
