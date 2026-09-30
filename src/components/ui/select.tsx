import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Radix's Root, with one guard: an EMPTY value is never passed on.
 *
 * Radix renders a hidden native `<select>` beside the trigger so the control
 * participates in a real `<form>`. That select's effect answers a PROGRAMMATIC
 * value change by writing the value into itself and dispatching `change`, which
 * Radix routes straight back out through `onValueChange`. When the new value is
 * not one the native select can hold yet, what comes back is `''` — and a
 * field bound to react-hook-form then stores that empty string over the value
 * it was just given.
 *
 * That is how every edit page built on `ResourceFormPage` lost its Status: the
 * scaffold fills the form with `form.reset(toValues(record))` after mount, the
 * echo fired, and the select rendered blank — then zod refused the save with an
 * invalid-option message about a field the merchant had never touched. It looks
 * exactly like a form that simply will not save.
 *
 * SWALLOWING `''` IS SAFE, and it is not a heuristic: Radix forbids a
 * `SelectItem` with an empty value, so no shopper or merchant can ever choose
 * one. An empty `onValueChange` is therefore always this echo and never a
 * choice. A caller that wants a clearable control gives it an explicit
 * sentinel item, which passes through untouched.
 *
 * Fixed HERE rather than at each call site: the panel has dozens of these, the
 * symptom is silent, and the next form built would inherit it again.
 */
export function Select({
  onValueChange,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <SelectPrimitive.Root
      {...props}
      onValueChange={(value) => {
        if (value === '') return
        onValueChange?.(value)
      }}
    />
  )
}
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // `min-w-0` + truncation on the value span keep a long label (e.g. a deep category name) on
      // one line and ellipsised inside the trigger instead of wrapping and overflowing the box.
      // Scoped to the value span, not `*:`, so the chevron keeps its intrinsic size.
      'flex h-10 w-full min-w-0 items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2.5 py-1 text-sm text-foreground [&>span:first-child]:min-w-0 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-72 min-w-32 overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-md',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
        <ChevronUp className="size-3.5" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
        <ChevronDown className="size-3.5" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName
