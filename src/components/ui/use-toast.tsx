import * as React from 'react'
import hotToast from 'react-hot-toast'

type Variant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

type Toast = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: Variant
}

/**
 * Per-variant colour, drawn from the design tokens in `index.css`.
 *
 * react-hot-toast's own `.error()` / `.success()` only swap the icon — the
 * surface stays white either way. These styles are what actually make an
 * error read as red and a success as green.
 *
 * `default` is deliberately treated as success: most call sites fire a bare
 * `toast({ title: 'Saved' })` on a happy path without naming a variant.
 */
const VARIANT_STYLE: Record<Variant, { bg: string; fg: string; border: string }> = {
  default: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'var(--color-success)' },
  success: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'var(--color-success)' },
  destructive: { bg: '#fef3f2', fg: 'var(--color-destructive)', border: 'var(--color-destructive)' },
  warning: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', fg: 'var(--color-info)', border: 'var(--color-info)' },
}

function ToastMessage({ title, description }: Toast) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && <p className="text-sm font-semibold">{title}</p>}
      {description && <p className="text-xs opacity-80">{description}</p>}
    </div>
  )
}

/** Fires a toast notification, rendered by react-hot-toast's `<Toaster />`. */
export function toast({ title, description, variant = 'default' }: Toast) {
  const message = <ToastMessage title={title} description={description} />
  const { bg, fg, border } = VARIANT_STYLE[variant] ?? VARIANT_STYLE.default

  const options = {
    style: {
      background: bg,
      color: fg,
      border: `1px solid ${border}`,
      // The icon is tinted via its own colour; keep the ✕/✓ glyph readable on
      // the tinted surface rather than on react-hot-toast's white default.
      borderLeftWidth: '4px',
    },
    iconTheme: { primary: fg, secondary: bg },
  }

  if (variant === 'destructive') return hotToast.error(message, options)
  if (variant === 'warning') return hotToast(message, { ...options, icon: '⚠️' })
  if (variant === 'info') return hotToast(message, { ...options, icon: 'ℹ️' })
  return hotToast.success(message, options)
}
