import { describe, expect, it } from 'vitest'
import { numberWithDefault, optionalNumber, requiredNumber } from '@/lib/validation/numeric'

/**
 * `specs/admin-shell` — "Numeric fields accept an empty value distinctly from
 * zero". The whole point of these helpers is that clearing a field and typing 0
 * do not collapse into the same value, so that is what is pinned hardest here.
 *
 * The inputs are strings because that is what a native number input hands back
 * through react-hook-form's default `onChange`; `NumberInput` does not convert.
 */

describe('optionalNumber', () => {
  it('parses a cleared field to undefined, not zero', () => {
    const result = optionalNumber().safeParse('')
    expect(result.success).toBe(true)
    expect(result.success && result.data).toBeUndefined()
  })

  it('parses an explicit zero to zero', () => {
    const result = optionalNumber().safeParse('0')
    expect(result.success).toBe(true)
    expect(result.success && result.data).toBe(0)
  })

  it('keeps empty and zero distinguishable', () => {
    const empty = optionalNumber().safeParse('')
    const zero = optionalNumber().safeParse('0')
    expect(empty.success && empty.data).not.toBe(zero.success && zero.data)
  })

  it('treats null and undefined as empty, for a nullable API field', () => {
    expect(optionalNumber().safeParse(null).success).toBe(true)
    expect(optionalNumber().safeParse(undefined).success).toBe(true)
    const fromNull = optionalNumber().safeParse(null)
    expect(fromNull.success && fromNull.data).toBeUndefined()
  })

  it('refuses a negative value with the default message', () => {
    const result = optionalNumber().safeParse('-1')
    expect(result.success).toBe(false)
    expect(!result.success && result.error.issues[0].message).toBe('Cannot be negative')
  })

  it('refuses a negative value with a caller-supplied message', () => {
    const result = optionalNumber({ message: 'Offer price cannot be negative' }).safeParse('-1')
    expect(!result.success && result.error.issues[0].message).toBe('Offer price cannot be negative')
  })

  it('honours a min other than zero', () => {
    expect(optionalNumber({ min: 1 }).safeParse('0').success).toBe(false)
    expect(optionalNumber({ min: 1 }).safeParse('1').success).toBe(true)
  })

  it('honours a max', () => {
    const rule = optionalNumber({ min: 1, max: 5, message: 'Rate between 1 and 5' })
    expect(rule.safeParse('5').success).toBe(true)
    const tooHigh = rule.safeParse('6')
    expect(tooHigh.success).toBe(false)
    expect(!tooHigh.success && tooHigh.error.issues[0].message).toBe('Rate between 1 and 5')
  })

  it('allows a negative value when min is explicitly unbounded', () => {
    // A sort order may legitimately go below zero; the default floor would
    // refuse it.
    expect(optionalNumber({ min: null }).safeParse('-3').success).toBe(true)
    const result = optionalNumber({ min: null }).safeParse('-3')
    expect(result.success && result.data).toBe(-3)
  })

  it('coerces the string a number input produces', () => {
    const result = optionalNumber().safeParse('12.5')
    expect(result.success && result.data).toBe(12.5)
  })
})

describe('requiredNumber', () => {
  it('refuses a cleared field with the required message', () => {
    const result = requiredNumber('Offer price is required').safeParse('')
    expect(result.success).toBe(false)
    expect(!result.success && result.error.issues[0].message).toBe('Offer price is required')
  })

  it('accepts an explicit zero', () => {
    const result = requiredNumber('Offer price is required').safeParse('0')
    expect(result.success).toBe(true)
    expect(result.success && result.data).toBe(0)
  })

  it('applies its bounds separately from the required message', () => {
    const rule = requiredNumber('Required', { message: 'Cannot be negative' })
    const negative = rule.safeParse('-5')
    expect(!negative.success && negative.error.issues[0].message).toBe('Cannot be negative')
  })
})

describe('numberWithDefault', () => {
  it('falls back when the field is left blank', () => {
    const result = numberWithDefault(5).safeParse('')
    expect(result.success && result.data).toBe(5)
  })

  it('does not override an explicit zero with the fallback', () => {
    const result = numberWithDefault(5).safeParse('0')
    expect(result.success && result.data).toBe(0)
  })

  it('still applies its bounds to a given value', () => {
    expect(numberWithDefault(5).safeParse('-1').success).toBe(false)
  })
})
