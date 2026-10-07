import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted border border-border',
        outline: 'border border-input bg-background hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /*
        `pointer-coarse:` sizes for touch screens, where the compact desktop
        sizes (28px default, 25px `sm` — this panel's spacing step is 0.22rem)
        are too small for a finger. Keyed on the POINTER, not the width: a narrow
        desktop window keeps the compact sizes, a tablet in landscape gets these.

        `min-h`/`min-w`, never `h`/`w`: a minimum beats a caller's own `size-7`
        or `h-6` regardless of class order, and `tailwind-merge` keeps variant
        classes apart from base ones, so no caller can cancel these by accident.
        Every icon button grows on touch — including the ⋯ in table rows, the
        controls that were too small. Pixel values rather than spacing steps, so
        the numbers mean what they say.

        See server/openspec/changes/add-admin-mobile-shell, design.md Decision 6.
      */
      size: {
        default: 'h-8 px-3 pointer-coarse:min-h-[44px]',
        sm: 'h-7 px-2.5 text-xs pointer-coarse:min-h-[40px]',
        lg: 'h-9 px-4 pointer-coarse:min-h-[44px]',
        icon: 'h-8 w-8 pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
