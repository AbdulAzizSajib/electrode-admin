import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          // `form.tsx` has always set aria-invalid on a failing field, but the
          // input rendered identically either way, so the attribute reached
          // assistive tech and nothing reached the eye. Border AND ring, not
          // border alone: on a row already tinted by EditorRow's own error
          // border, a second red border is not a distinguishable signal.
          'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
