import * as React from 'react'
import { Loader2 } from 'lucide-react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils/cn'

/**
 * A choice of arrangements, made by looking at them: a radio group of cards,
 * each with a drawing, a name and a line of description.
 *
 * ── Why this is shared ────────────────────────────────────────────────────
 *
 * It was the hero picker's own markup. The second section to offer layouts
 * (featured categories) needed the same card, and the same card in two places
 * is exactly the failure class that picker kept hitting: it was wrong three
 * times in one week, every time in the SHELL rather than the diagrams, and
 * every fix was a comment that would have had to be maintained twice. The
 * diagrams stay with their features — a drawing of one arrangement has nothing
 * to share — and the shell lives here once.
 *
 * ── Why a radio group and not a Select ───────────────────────────────────
 *
 * Partly because a handful of options are faster to read than to open. Mostly
 * because a Radix `Select` mounted before its record has loaded clears
 * react-hook-form's `values` reset and silently blocks the save — a failure the
 * hero panel has hit before. A radio group carries the same roving focus and
 * arrow-key movement without that.
 *
 * ── Two rules that look like styling and are not ─────────────────────────
 *
 * NO `h-full` ON A CARD. The cards sit in one grid row and their descriptions
 * are different lengths, so a card has to fill the row's height or it leaves a
 * band of dead space below it inside the cell — and that band is not part of
 * the button, so a click landing there does nothing. `h-full` is
 * `height: 100%`, and a percentage height on a grid item resolves against the
 * row height, which the items' own content is what determines. That is
 * circular, and browsers resolve it inconsistently — which is why ONE card
 * rendered taller than the others while the markup for every card was
 * byte-identical. A grid item already gets `align-self: stretch`, so it fills
 * the row's height with no height declaration at all. `items-stretch` on the
 * card is the INNER flex column's cross-axis rule, unrelated to this, kept so
 * the children span the card's width.
 *
 * `saving` NAMES ONE OPTION, and is never a shared mutation's `isPending`. A
 * settings mutation is one hook across every editor, so its pending flag is
 * true while ANY of them is saving — disabling the whole group on it made the
 * hero picker dead for reasons a merchant could not see. Only the card being
 * written shows a pending state; the rest stay live, so a merchant who clicks
 * the wrong one can immediately click the right one.
 *
 * See openspec/changes/add-hero-section-variants-admin, design.md Decision 3,
 * and server/openspec/changes/add-featured-categories-layout, design.md Decision 3.
 */

export interface LayoutOption<K extends string> {
  value: K
  label: string
  description: string
}

/**
 * Literal class per count, because Tailwind only emits classes it can see.
 * Keep the count equal to the option list's length; a mismatch strands a card
 * alone on a second row at xl.
 */
const COLUMNS = {
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
} as const

export function LayoutPicker<K extends string>({
  options,
  value,
  onChange,
  saving = null,
  label,
  columns,
  diagram,
  footer,
}: {
  options: readonly LayoutOption<K>[]
  value: K
  onChange: (next: K) => void
  /** The option currently being written, or null. See the header. */
  saving?: K | null
  /** The group's accessible name, e.g. "Hero layout". */
  label: string
  /** One column per option at xl. */
  columns: keyof typeof COLUMNS
  /** The drawing for an option; `className` carries the colour and sizing. */
  diagram: (value: K, props: { className: string }) => React.ReactNode
  /**
   * Optional per-option block pinned to the card's bottom — the hero uses it
   * for each layout's artwork sizes. Rendered in a fixed-minimum-height slot
   * so cards with different footer lengths still share a baseline.
   */
  footer?: (value: K) => React.ReactNode
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as K)}
      aria-label={label}
      /*
       * `items-stretch` (grid's default, stated here so it is not removed by
       * accident) is what makes every card the height of the tallest — see the
       * header for why a card must not also declare a height.
       */
      className={cn('grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2', COLUMNS[columns])}
    >
      {options.map((option) => {
        const selected = option.value === value
        const pending = saving === option.value

        return (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            aria-label={option.label}
            disabled={pending}
            className={cn(
              'flex flex-col items-stretch gap-2 rounded-md border p-3 text-left transition-colors',
              'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/40',
            )}
          >
            {diagram(option.value, {
              className: cn(
                'h-auto w-full shrink-0',
                selected ? 'text-primary' : 'text-muted-foreground',
              ),
            })}
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {option.label}
              {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </span>
            {/*
              `min-h-*`, not free height. Descriptions wrap to a different
              number of lines at the same card width — which is what made the
              hero's cards different heights. Reserving three lines' worth means
              the text block is the same height in every card whatever it says,
              and a longer description added later grows the block rather than
              breaking the row.
            */}
            <span className="min-h-12 text-xs text-muted-foreground">{option.description}</span>

            {/*
              ALSO `min-h-*`, for the same reason: a footer may be one row for
              one option and three for another. `mt-auto` then pins the block to
              the card's bottom, so footers share a baseline a merchant can read
              across. It needs the card to be a stretched flex column, which is
              why the card must not carry `h-full` — see the header.
            */}
            {footer && (
              <span className="mt-auto flex min-h-14 flex-col gap-0.5 border-t border-border/60 pt-2 text-[11px] tabular-nums text-muted-foreground">
                {footer(option.value)}
              </span>
            )}
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
}
