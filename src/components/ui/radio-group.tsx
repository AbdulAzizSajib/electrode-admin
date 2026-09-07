import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils/cn'

/**
 * One choice from a short, fixed set — presented all at once rather than behind
 * a dropdown, because three options are faster to read than to open.
 *
 * Radix gives the part that is easy to get wrong by hand: the group is a single
 * tab stop with roving focus inside it, so a keyboard user tabs *past* the field
 * rather than through every option, and the arrow keys move the selection.
 *
 * `SegmentedRadioGroup` is the styling this panel actually uses — a joined row
 * of buttons, replacing antd's `Radio.Group optionType="button"`. The unstyled
 * `RadioGroup`/`RadioGroupItem` pair is exported for anything wanting classic
 * radio dots.
 */

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn('flex flex-wrap gap-2', className)} {...props} />
))
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'size-4 shrink-0 rounded-full border border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-primary" />
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export interface SegmentedOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface SegmentedRadioGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  options: SegmentedOption[]
}

/**
 * The segmented-button styling. Each option is a real radio, so the group keeps
 * its single tab stop and arrow-key movement — it only looks like a button row.
 */
export const SegmentedRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  SegmentedRadioGroupProps
>(({ className, options, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn('inline-flex w-fit max-w-full flex-wrap items-center gap-0 rounded-md border border-input p-0.5', className)}
    {...props}
  >
    {options.map((option) => (
      <RadioGroupPrimitive.Item
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        className={cn(
          'rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1 text-sm text-muted-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:text-primary-foreground',
        )}
      >
        {option.label}
      </RadioGroupPrimitive.Item>
    ))}
  </RadioGroupPrimitive.Root>
))
SegmentedRadioGroup.displayName = 'SegmentedRadioGroup'
