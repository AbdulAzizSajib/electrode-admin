import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface FormSectionProps {
  /** The group's name — "Search engine listing". Rendered as the legend. */
  title: string
  /** One line on what the group is for, when the title alone leaves it ambiguous. */
  description?: string
  /** Two-up on wide screens for short, related values. Defaults to one column. */
  columns?: 1 | 2
  className?: string
  children: ReactNode
}

/**
 * A titled group of fields *inside* a single form card.
 *
 * The product form already grouped its thirty-odd fields — General, Search
 * engine listing, Organization, Pricing & rules — but it bought that grouping by
 * bypassing `ResourceFormPage` entirely and laying out its own `<Card>` per
 * group. Every form that does use the shared page therefore had no way to group
 * at all, and the longer ones (categories at twelve fields) read as one
 * undifferentiated column where artwork, ordering and SEO all carry equal
 * weight.
 *
 * Nesting a `<Card>` per group inside the page's own card was the obvious fix
 * and is the wrong one: a card inside a card gives two competing borders and two
 * radii for one piece of content. A `<fieldset>` with a rule above it separates
 * the groups using the border token already on the page, adds no new surface,
 * and — unlike a bare `<div>` plus an `<h3>` — is what a screen reader announces
 * as a group, so "Search result title" is heard inside "Search engine listing"
 * rather than as the eleventh unqualified field on the page.
 *
 * The first section carries no rule or top padding: the card's own edge is
 * already the separator, and a rule immediately below it would read as a second
 * border on the card.
 */
export function FormSection({
  title,
  description,
  columns = 1,
  className,
  children,
}: FormSectionProps) {
  return (
    <fieldset
      className={cn(
        /*
         * `ResourceFormPage` already puts `gap-4` between its children, so the
         * rule lands 4 units below the previous group and the padding here is
         * what sits *above* the title. More space above a heading than below it:
         * `pt-5` over the `gap-4` to the fields.
         */
        'flex min-w-0 flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0',
        className,
      )}
    >
      {/*
       * `float-none` is load-bearing: a `<legend>` inside a flex container is
       * still laid out by the browser's own legend rules unless it is taken out
       * of them, and Tailwind's preflight does not do that. Without it the title
       * sits on the fieldset's border rather than above the fields.
       */}
      <legend className="float-none flex flex-col gap-1 p-0">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </legend>

      <div
        className={cn(
          'grid min-w-0 grid-cols-1 gap-x-4 gap-y-5',
          columns === 2 && 'sm:grid-cols-2',
        )}
      >
        {children}
      </div>
    </fieldset>
  )
}
