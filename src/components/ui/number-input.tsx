import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { Input } from '@/components/ui/input'

/**
 * A numeric form field — the replacement for antd's `InputNumber`.
 *
 * Deliberately does NOT own `onChange`. "Left empty" and "zero" are different
 * answers, but the panel settles that difference in the zod schema
 * (`lib/validation/numeric`), not here: react-hook-form's default handler puts
 * the input's raw string on the field, and `optionalNumber`'s `z.preprocess`
 * turns `''` into `undefined` before `z.coerce.number()` can make it a `0`.
 *
 * Keeping the rule in one layer matters. A component that emitted
 * `number | undefined` would fight `z.coerce`, would stop working with a bare
 * `register()`, and would still leave the `preprocess` in place for every field
 * that can be cleared — the same rule written twice, disagreeing eventually.
 *
 * So what is left here is the other half, which every numeric field did inline:
 * a stored `undefined` or `null` must render as an empty box rather than as the
 * string "undefined".
 *
 * See openspec/changes/remove-antd-from-admin, design.md Decision 4.
 */

export interface NumberInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value'> {
  /**
   * Whatever react-hook-form holds — a number once typed, the raw string while
   * typing, `undefined` when cleared.
   *
   * Typed `unknown` rather than `number | string` on purpose: a field whose
   * schema is a `z.preprocess` (which is every field using
   * `lib/validation/numeric`) infers its input type as `unknown`, and narrowing
   * here would only push a cast onto all eighteen call sites. The render path
   * below handles any value, so the wider type costs nothing.
   */
  value?: unknown
  /**
   * A unit joined to the right of the field — antd's `addonAfter`. Used for the
   * tax rule's `%`, where the number alone is ambiguous.
   */
  suffix?: React.ReactNode
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, suffix, ...props }, ref) => {
    const input = (
      <Input
        type="number"
        ref={ref}
        // `null` reaches here from a nullable API field, `undefined` from a
        // cleared one. Both are "no number", and React would otherwise flip the
        // input from controlled to uncontrolled and warn.
        value={value === undefined || value === null ? '' : String(value)}
        className={cn(suffix != null && 'rounded-r-none', className)}
        {...props}
      />
    )

    if (suffix == null) return input

    return (
      <div className="flex w-full">
        {input}
        <span className="inline-flex shrink-0 items-center rounded-r-md border border-l-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
          {suffix}
        </span>
      </div>
    )
  },
)
NumberInput.displayName = 'NumberInput'
