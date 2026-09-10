import { z } from 'zod'

/**
 * Numeric field rules, shared by every form in the panel.
 *
 * Lifted out of `product-form-page.tsx`, which worked this out first and left
 * the reasoning in a comment worth keeping:
 *
 *   antd's `InputNumber` handed back `null` for an emptied field. A native
 *   number input hands back `''`, and `z.coerce.number()` turns `''` into 0 —
 *   which would save a cleared "Regular price" as a regular price of zero
 *   rather than as "this product is not on offer".
 *
 * So "left empty" and "zero" stay different answers, and the difference is
 * settled here rather than in the input component: `NumberInput` deliberately
 * does not own `onChange`, so react-hook-form puts the raw string on the field
 * and the `preprocess` below is what stops it becoming a number too early.
 *
 * See openspec/changes/remove-antd-from-admin, design.md Decision 4, and
 * `specs/admin-shell` — "Numeric fields accept an empty value distinctly from
 * zero".
 */

export interface NumberRuleOptions {
  /**
   * Defaults to 0 — the common case is "this cannot be negative". Pass `null`
   * for a field that may legitimately go below zero, such as a sort order.
   */
  min?: number | null
  max?: number
  /** Shown when the value falls outside `min`/`max`. */
  message?: string
}

/** `''`, `null` and `undefined` all mean "no number given". Anything else is left alone. */
const emptyToUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

function bounded({ min = 0, max, message = 'Cannot be negative' }: NumberRuleOptions, required?: string) {
  let schema = required ? z.coerce.number({ message: required }) : z.coerce.number()
  if (min !== null) schema = schema.min(min, message)
  if (max !== undefined) schema = schema.max(max, message)
  return schema
}

/**
 * An amount that may be left blank. A cleared field parses to `undefined`, never
 * to `0`, so the two remain distinguishable all the way to the request.
 */
export const optionalNumber = (options: NumberRuleOptions = {}) =>
  z.preprocess(emptyToUndefined, bounded(options).optional())

/**
 * An amount that must be given. `required` is the message shown when the field
 * is left blank; `message` covers the bounds.
 */
export const requiredNumber = (required: string, options: NumberRuleOptions = {}) =>
  z.preprocess(emptyToUndefined, bounded(options, required))

/**
 * An amount that falls back to `fallback` when left blank, for a field the
 * merchant may ignore but the record cannot be without.
 */
export const numberWithDefault = (fallback: number, options: NumberRuleOptions = {}) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? fallback : value),
    bounded(options),
  )
