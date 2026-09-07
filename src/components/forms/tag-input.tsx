import * as React from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useTagSuggestions } from '@/lib/api/tags'
import { cn } from '@/lib/utils/cn'

/**
 * Free-form keywords with suggestions drawn from tags the shop already uses.
 *
 * The suggestion is the whole point: without it a merchant types "Wireless"
 * beside an existing "wireless" and the two never group anything together
 * again. See `specs/catalog-management` — "Keywords are reused rather than
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
 *
 * Built directly rather than on `components/ui/combobox`, despite both showing
 * a filtered list under a field. A combobox commits an option the caller
 * supplied and hides its search box inside the popover; this field's whole job
 * is to accept a word nobody has typed before, straight into the control the
 * chips sit in. Sharing the code would have meant teaching the combobox to
 * invent options, which is the one thing a select must not do.
 */

export interface TagInputProps {
  value?: string[]
  onChange?: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Refuses anything longer, matching the backend's column. */
  maxLength?: number
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  onBlur?: () => void
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
  id,
  onBlur,
  ...aria
}: TagInputProps) {
  const [term, setTerm] = React.useState('')
  const [highlight, setHighlight] = React.useState(-1)
  const { data: suggestions = [], isFetching } = useTagSuggestions(term)

  const listId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)

  // A tag already on this product is not a suggestion — offering it would
  // invite a click that does nothing.
  const chosen = new Set(value.map((tag) => tag.toLowerCase()))
  const options = suggestions.filter((tag) => !chosen.has(tag.name.toLowerCase()))

  // The server has already filtered on the term; re-filtering here would hide
  // suggestions it matched on a different part of the name.
  const open = term.trim().length > 0

  /*
   * Clamped on read rather than corrected in an effect. The suggestion list
   * shrinks as the merchant types, and an effect that pulled the highlight back
   * into range would set state during render's commit — a cascading render for
   * something derivable from what is already known.
   */
  const highlighted = highlight < options.length ? highlight : -1

  const commit = (tag: string) => {
    const next = normalise([...value, tag], maxLength)
    onChange?.(next)
    setTerm('')
    setHighlight(-1)
  }

  const remove = (tag: string) => {
    // By identity, not by substring: removing "less" must leave "wireless".
    onChange?.(value.filter((existing) => existing !== tag))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter':
      case ',': {
        event.preventDefault()
        // A highlighted suggestion wins; otherwise whatever was typed, even if
        // it matches nothing — that is how a new keyword comes into existence.
        const picked = highlighted >= 0 ? options[highlighted]?.name : undefined
        const text = picked ?? term
        if (text.trim()) commit(text)
        break
      }
      case 'ArrowDown':
        if (!open || options.length === 0) break
        event.preventDefault()
        setHighlight((current) => (current + 1) % options.length)
        break
      case 'ArrowUp':
        if (!open || options.length === 0) break
        event.preventDefault()
        setHighlight((current) => (current - 1 + options.length) % options.length)
        break
      case 'Escape':
        if (!open) break
        event.preventDefault()
        setTerm('')
        setHighlight(-1)
        break
      case 'Backspace':
        // Only when there is nothing to delete in the field itself, so this
        // never eats a character the merchant meant to remove.
        if (term === '' && value.length > 0) {
          event.preventDefault()
          remove(value[value.length - 1])
        }
        break
    }
  }

  const activeId =
    highlighted >= 0 && options[highlighted] ? `${listId}-option-${highlighted}` : undefined

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div
            onClick={() => inputRef.current?.focus()}
            className={cn(
              'flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1',
              'focus-within:ring-2 focus-within:ring-ring',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {value.map((tag) => (
              <Badge key={tag} variant="secondary" className="pr-1">
                <span className="max-w-40 truncate">{tag}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation()
                    remove(tag)
                  }}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={inputRef}
              id={id}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              value={term}
              disabled={disabled}
              placeholder={value.length === 0 ? placeholder : ''}
              onChange={(event) => {
                setTerm(event.target.value)
                setHighlight(-1)
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setTerm('')
                setHighlight(-1)
                onBlur?.()
              }}
              className="h-6 min-w-32 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              {...aria}
            />
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-(--radix-popover-trigger-width) p-1"
          // The caret must stay in the field: this list is driven entirely by
          // `aria-activedescendant`.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {isFetching && options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No matching keyword — press Enter to add it
            </p>
          ) : (
            <ul role="listbox" id={listId} aria-label="Keyword suggestions" className="max-h-52 overflow-y-auto">
              {options.map((tag, index) => (
                <li
                  key={tag.id}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  // `onMouseDown`: a click would blur the field first, clearing
                  // the term and closing the list before the pick is read.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    commit(tag.name)
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    'cursor-pointer rounded-sm px-2 py-1.5 text-sm text-foreground',
                    index === highlighted && 'bg-muted',
                  )}
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
