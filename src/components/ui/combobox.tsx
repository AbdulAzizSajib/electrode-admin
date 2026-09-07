import * as React from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  CreateActionButton,
  type ComboboxCreateAction,
} from '@/components/ui/create-action-button'
import { cn } from '@/lib/utils/cn'

/**
 * A select whose list you narrow by typing.
 *
 * Radix `Select` — `components/ui/select` — deliberately has no search, and a
 * brand list grows past what anyone will scroll. Built on the Popover and Input
 * already in this kit rather than on a second option-list dependency; see
 * design.md Decision 5 of `migrate-product-form-to-shadcn`.
 *
 * The search field lives *inside* the popover rather than overlaying the
 * trigger. An overlay put two `role="combobox"` elements in the document at
 * once — the trigger and the field — which reads to a screen reader as two
 * separate controls with the same name.
 *
 * The keyboard contract is why this file is longer than a `<select>`: the
 * highlight is state, published through `aria-activedescendant`, so the arrows
 * move through options while the caret stays in the search field.
 *
 * "Nothing matched", "still loading" and "there are none" are three different
 * messages, because a merchant reading an empty box cannot tell which of the
 * three they are looking at — the failure the product form's own comments call
 * out about antd's empty dropdowns.
 */

export interface ComboboxOption {
  value: string
  label: string
  /** Searched alongside the label; use for a code or a secondary name. */
  keywords?: string
  disabled?: boolean
}

export interface ComboboxProps {
  value?: string | null
  onValueChange?: (value: string | null) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Names the search field, e.g. "Search brands". Defaults from the label. */
  searchPlaceholder?: string
  /** Shown when the typed term matches nothing. */
  emptyText?: string
  /** Shown instead of the list while the options are still being fetched. */
  loading?: boolean
  loadingText?: string
  /** Shown when there are genuinely no options and nothing has been typed. */
  noOptionsText?: string
  /** Offers a control that returns the field to no selection. */
  clearable?: boolean
  disabled?: boolean
  className?: string
  contentClassName?: string
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  /**
   * Turns off local filtering, for a list the server has already filtered.
   * Pair with `onSearchChange` to drive the query.
   */
  filter?: boolean
  onSearchChange?: (term: string) => void
  onBlur?: () => void
  /** Offers one action below the options. See `ComboboxCreateAction`. */
  createAction?: ComboboxCreateAction
}

/** Case-insensitive "does this option match what was typed". */
export function matchesTerm(option: ComboboxOption, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.keywords?.toLowerCase().includes(needle) ?? false)
  )
}

export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      value = null,
      onValueChange,
      options,
      placeholder = 'Select',
      searchPlaceholder = 'Search',
      emptyText = 'Nothing matches what you typed',
      loading = false,
      loadingText = 'Loading options…',
      noOptionsText = 'There are none yet',
      clearable = false,
      disabled = false,
      className,
      contentClassName,
      id,
      filter = true,
      onSearchChange,
      onBlur,
      createAction,
      ...aria
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const [term, setTerm] = React.useState('')
    const [highlight, setHighlight] = React.useState(0)

    const listId = React.useId()
    const selected = options.find((option) => option.value === value) ?? null

    const visible = React.useMemo(
      () => (filter ? options.filter((option) => matchesTerm(option, term)) : options),
      [options, term, filter],
    )

    // Keep the highlight inside the narrowed list — typing until one option is
    // left must not leave it pointing past the end.
    React.useEffect(() => {
      setHighlight((current) => (current < visible.length ? current : 0))
    }, [visible.length])

    const handleOpenChange = (next: boolean) => {
      setOpen(next)
      if (next) {
        // Start on the selected option, so opening and pressing Enter is a
        // no-op rather than a silent change to whatever happens to be first.
        const index = options.findIndex((option) => option.value === value)
        setHighlight(index === -1 ? 0 : index)
      } else {
        setTerm('')
        onSearchChange?.('')
      }
    }

    const commit = (option: ComboboxOption) => {
      if (option.disabled) return
      onValueChange?.(option.value)
      handleOpenChange(false)
    }

    /** Arrow / Home / End / Enter, from the search field. Escape is Radix's. */
    const handleSearchKeyDown = (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setHighlight((current) => (visible.length === 0 ? 0 : (current + 1) % visible.length))
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlight((current) =>
            visible.length === 0 ? 0 : (current - 1 + visible.length) % visible.length,
          )
          break
        case 'Home':
          event.preventDefault()
          setHighlight(0)
          break
        case 'End':
          event.preventDefault()
          setHighlight(Math.max(0, visible.length - 1))
          break
        case 'Enter': {
          event.preventDefault()
          const option = visible[highlight]
          if (option) commit(option)
          break
        }
      }
    }

    const activeId = visible[highlight] ? `${listId}-option-${highlight}` : undefined

    return (
      <div className={cn('relative flex w-full items-center', className)}>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              ref={ref}
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-haspopup="listbox"
              disabled={disabled}
              onBlur={onBlur}
              className={cn(
                'flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-left text-sm text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                // Room for the clear control, so a long label does not run under it.
                clearable && selected && 'pr-8',
              )}
              {...aria}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
                  !selected && 'text-muted-foreground',
                )}
              >
                {selected ? selected.label : placeholder}
              </span>
              {loading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin opacity-60" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 opacity-60" />
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            sideOffset={4}
            className={cn('w-(--radix-popover-trigger-width) p-1', contentClassName)}
          >
            <Input
              autoFocus
              value={term}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setTerm(event.target.value)
                onSearchChange?.(event.target.value)
                setHighlight(0)
              }}
              onKeyDown={handleSearchKeyDown}
              className="mb-1"
            />

            {loading ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">{loadingText}</p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {term.trim() ? emptyText : noOptionsText}
              </p>
            ) : (
              <ul
                role="listbox"
                id={listId}
                aria-label={aria['aria-label']}
                className="max-h-60 overflow-y-auto"
              >
                {visible.map((option, index) => (
                  <li
                    key={option.value}
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    // `onMouseDown`, not `onClick`: a click blurs the search
                    // field first, which closes the popover before the
                    // selection is read.
                    onMouseDown={(event) => {
                      event.preventDefault()
                      commit(option)
                    }}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground',
                      index === highlight && 'bg-muted',
                      option.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <Check
                      className={cn(
                        'size-3.5 shrink-0',
                        option.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {/*
             * Outside the branch above, so it survives all three settled
             * states — including "nothing matches what you typed", which is
             * precisely when a merchant needs it. Withheld while loading: they
             * cannot yet know whether what they want is missing.
             */}
            {createAction && !loading && (
              <CreateActionButton action={createAction} onClose={() => handleOpenChange(false)} />
            )}
          </PopoverContent>
        </Popover>

        {clearable && selected && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => onValueChange?.(null)}
            className="absolute right-6 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    )
  },
)
Combobox.displayName = 'Combobox'
