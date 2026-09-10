import * as React from 'react'
import { Check, ChevronsUpDown, FileText, Link2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePublishedPages } from '@/lib/api/pages'
import { cn } from '@/lib/utils/cn'

/**
 * Where a nav or footer link points.
 *
 * Deliberately a text input WITH a picker rather than a pure dropdown. A
 * merchant linking to their Refund Policy should not have to remember its
 * address — but they also need to be able to point a link at an external URL,
 * a query string like `/products?sort=new`, or a route this list has never
 * heard of. Constraining it to known targets would break the second case to
 * make the first slightly tidier.
 */

/** Storefront routes that exist as real pages, offered alongside published CMS pages. */
const STOREFRONT_ROUTES: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Shop (all products)', href: '/products' },
  { label: 'Best selling', href: '/products?sort=best' },
  { label: 'New arrivals', href: '/products?sort=new' },
  { label: "Today's offers", href: '/deals' },
  { label: 'Blogs', href: '/blogs' },
  { label: 'Contact', href: '/contact' },
  { label: 'Track order', href: '/track-order' },
  { label: 'Gift cards', href: '/gift-cards' },
  { label: 'Wishlist', href: '/wishlist' },
  { label: 'Compare', href: '/compare' },
  { label: 'Cart', href: '/cart' },
  { label: 'My account', href: '/account' },
]

export interface LinkTargetInputProps {
  value: string
  onChange: (href: string) => void
  placeholder?: string
  'aria-label'?: string
  className?: string
  /** Mirrors the backend's cap on `href`, so a long paste never leaves the browser. */
  maxLength?: number
  /** Set when this target is the field a row-level error is about. */
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function LinkTargetInput({
  value,
  onChange,
  placeholder = '/about',
  className,
  maxLength,
  ...rest
}: LinkTargetInputProps) {
  const [open, setOpen] = React.useState(false)
  const { data: pages = [] } = usePublishedPages()

  const pageOptions = pages.map((page) => ({ label: page.title, href: `/${page.slug}` }))

  const pick = (href: string) => {
    onChange(href)
    setOpen(false)
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label={rest['aria-label']}
        aria-invalid={rest['aria-invalid']}
        aria-describedby={rest['aria-describedby']}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Choose a target"
          >
            <ChevronsUpDown className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-1">
          {pageOptions.length > 0 && (
            <>
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Your pages</p>
              {pageOptions.map((option) => (
                <OptionRow
                  key={option.href}
                  icon={<FileText className="size-3.5" />}
                  option={option}
                  selected={value === option.href}
                  onSelect={pick}
                />
              ))}
            </>
          )}
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Storefront</p>
          {STOREFRONT_ROUTES.map((option) => (
            <OptionRow
              key={option.href}
              icon={<Link2 className="size-3.5" />}
              option={option}
              selected={value === option.href}
              onSelect={pick}
            />
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function OptionRow({
  icon,
  option,
  selected,
  onSelect,
}: {
  icon: React.ReactNode
  option: { label: string; href: string }
  selected: boolean
  onSelect: (href: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.href)}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{option.label}</span>
        <span className="truncate text-xs text-muted-foreground">{option.href}</span>
      </span>
      {selected && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  )
}
