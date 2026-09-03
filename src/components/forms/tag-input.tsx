import * as React from 'react'
import { Select } from 'antd'
import { useTagSuggestions } from '@/lib/api/tags'

/**
 * Free-form keywords with suggestions drawn from tags the shop already uses.
 *
 * The suggestion is the whole point: without it a merchant types "Wireless"
 * beside an existing "wireless" and the two never group anything together
 * again. See `admin/product-authoring` — "Keywords are reused rather than
 * reinvented".
 *
 * Two bugs in the reference panel's version are deliberately not reproduced:
 *
 *  - Its Enter handler pushes the *event's* value object rather than the typed
 *    text, so a tag added with the keyboard arrives as `[object Object]`. Here
 *    the value is always an array of strings, and `onChange` is typed as such —
 *    there is no object to leak.
 *  - It de-duplicates with a substring match, so removing "less" also removes
 *    "wireless". Here duplicates are collapsed by exact, case-insensitive
 *    comparison, and removal is by identity.
 */

export interface TagInputProps {
  value?: string[]
  onChange?: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Refuses anything longer, matching the backend's column. */
  maxLength?: number
}

/**
 * Collapses blanks and case-insensitive repeats, keeping the first spelling the
 * merchant used. A product carries a keyword once however many times it is
 * added.
 */
function normalise(tags: string[], maxLength: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of tags) {
    const trimmed = raw.trim().slice(0, maxLength)
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Type a keyword and press Enter',
  disabled,
  maxLength = 60,
}: TagInputProps) {
  const [term, setTerm] = React.useState('')
  const { data: suggestions = [], isFetching } = useTagSuggestions(term)

  // A tag already on this product is not a suggestion — offering it would
  // invite a click that does nothing.
  const chosen = new Set(value.map((tag) => tag.toLowerCase()))
  const options = suggestions
    .filter((tag) => !chosen.has(tag.name.toLowerCase()))
    .map((tag) => ({ value: tag.name, label: tag.name }))

  return (
    <Select
      mode="tags"
      value={value}
      // Typed as string[] by antd in `tags` mode, which is what makes the
      // reference's object-instead-of-text bug unrepresentable here.
      onChange={(next: string[]) => onChange?.(normalise(next, maxLength))}
      onSearch={setTerm}
      onBlur={() => setTerm('')}
      searchValue={term}
      options={options}
      loading={isFetching}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full"
      // antd's own filter would hide suggestions the server matched on a
      // different part of the name; the server has already filtered.
      filterOption={false}
      notFoundContent={
        term.trim() ? (isFetching ? 'Searching…' : 'No matching keyword — press Enter to add it') : null
      }
      tokenSeparators={[',']}
    />
  )
}
