import * as React from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { matchesTerm, type ComboboxOption } from '@/components/ui/combobox'
import {
  CreateActionButton,
  type ComboboxCreateAction,
} from '@/components/ui/create-action-button'
import { cn } from '@/lib/utils/cn'

/**
 * Several values at once, each shown and removable on its own.
 *
 * The same narrow-by-typing list as `Combobox`, differing in what a click does:
 * here it toggles, and the popover stays open, because choosing three
 * collections should not mean opening the list three times.
 *
 * Each selection is a chip carrying its own remove control, so one can go
 * without disturbing the others — the failure mode of a plain multi-`<select>`,
 * where removing one means ctrl-clicking in a list and hoping.
 */

export interface MultiSelectProps {
  value?: string[]
  onValueChange?: (value: string[]) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  loading?: boolean
  loadingText?: string
  noOptionsText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  id?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  onBlur?: () => void
  /** Offers one action below the options. See `ComboboxCreateAction`. */
  createAction?: ComboboxCreateAction
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      value = [],
      onValueChange,
      options,
      placeholder = 'None',
      searchPlaceholder = 'Search',
      emptyText = 'Nothing matches what you typed',
      loading = false,
      loadingText = 'Loading options…',
      noOptionsText = 'There are none yet',
      disabled = false,
      className,
      contentClassName,
      id,
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

    const chosen = new Set(value)
    const selectedOptions = options.filter((option) => chosen.has(option.value))

    const visible = React.useMemo(
      () => options.filter((option) => matchesTerm(option, term)),
      [options, term],
    )

    React.useEffect(() => {
      setHighlight((current) => (current < visible.length ? current : 0))
    }, [visible.length])

    const toggle = (option: ComboboxOption) => {
      if (option.disabled) return
      onValueChange?.(
        chosen.has(option.value)
          ? value.filter((v) => v !== option.value)
          : [...value, option.value],
      )
    }

    const remove = (optionValue: string) => {
      onValueChange?.(value.filter((v) => v !== optionValue))
    }

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
          if (option) toggle(option)
          break
        }
      }
    }

    const activeId = visible[highlight] ? `${listId}-option-${highlight}` : undefined

    return (
      <div className={cn('flex w-full flex-col gap-1.5', className)}>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setTerm('')
          }}
        >
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
              )}
              {...aria}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
                  selectedOptions.length === 0 && 'text-muted-foreground',
                )}
              >
                {selectedOptions.length === 0
                  ? placeholder
                  : `${selectedOptions.length} selected`}
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
                aria-multiselectable
                aria-label={aria['aria-label']}
                className="max-h-60 overflow-y-auto"
              >
                {visible.map((option, index) => (
                  <li
                    key={option.value}
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={chosen.has(option.value)}
                    aria-disabled={option.disabled || undefined}
                    onMouseDown={(event) => {
                      // Stays open: picking three should not mean opening three times.
                      event.preventDefault()
                      toggle(option)
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
                        chosen.has(option.value) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {/*
             * The one thing that closes this popover rather than leaving it
             * open: toggling options is why it stays, but a dialog cannot open
             * inside a live popover. See `CreateActionButton`.
             */}
            {createAction && !loading && (
              <CreateActionButton
                action={createAction}
                onClose={() => {
                  setOpen(false)
                  setTerm('')
                }}
              />
            )}
          </PopoverContent>
        </Popover>

        {selectedOptions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((option) => (
              <Badge key={option.value} variant="secondary" className="pr-1">
                <span className="max-w-40 truncate">{option.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${option.label}`}
                  disabled={disabled}
                  onClick={() => remove(option.value)}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  },
)
MultiSelect.displayName = 'MultiSelect'
