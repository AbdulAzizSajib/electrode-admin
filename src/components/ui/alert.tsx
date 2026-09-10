import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * A message about the page as a whole, rather than about one field.
 *
 * Severity is never carried by colour alone: each variant renders its own icon
 * and a visually-hidden word naming what it is, so the three stay distinct with
 * colour removed and read correctly to a screen reader.
 *
 * Only a message the operator can actually act on takes a close control — one
 * describing a condition still in force (a reference list that failed to load,
 * a product that will not open) has nothing to dismiss to, so `onDismiss` is
 * omitted and no control is drawn.
 */

const alertVariants = cva(
  'relative flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm',
  {
    variants: {
      variant: {
        default: 'border-info/20 bg-info-bg text-foreground',
        success: 'border-success/20 bg-success-bg text-foreground',
        warning: 'border-warning/20 bg-warning-bg text-foreground',
        destructive: 'border-destructive/20 bg-destructive/10 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const SEVERITY = {
  default: { Icon: Info, tone: 'text-info', word: 'Information:' },
  success: { Icon: CheckCircle2, tone: 'text-success', word: 'Success:' },
  warning: { Icon: AlertTriangle, tone: 'text-warning', word: 'Warning:' },
  destructive: { Icon: AlertCircle, tone: 'text-destructive', word: 'Error:' },
} as const

export interface AlertProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof alertVariants> {
  /** The headline. Rendered in medium weight above any description. */
  title?: React.ReactNode
  /** Supporting detail, beneath the title. */
  children?: React.ReactNode
  /** Given only for a message the operator can act on; its absence draws no close control. */
  onDismiss?: () => void
  /** Overrides the per-variant default; `undefined` opts out of a live region entirely. */
  role?: React.AriaRole
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, children, onDismiss, role, ...props }, ref) => {
    const severity = SEVERITY[variant ?? 'default']
    const { Icon } = severity

    // A failure or a caution interrupts; an informational note does not. Passing
    // `role` explicitly overrides either way.
    const resolvedRole =
      role ?? (variant === 'warning' || variant === 'destructive' ? 'alert' : undefined)

    return (
      <div ref={ref} role={resolvedRole} className={cn(alertVariants({ variant }), className)} {...props}>
        <Icon className={cn('mt-0.5 size-4 shrink-0', severity.tone)} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Names the severity for anyone who cannot see the icon or the tint. */}
          <span className="sr-only">{severity.word}</span>
          {title && <span className="font-medium text-foreground">{title}</span>}
          {children && <div className="text-xs text-muted-foreground">{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    )
  },
)
Alert.displayName = 'Alert'
