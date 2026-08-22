import * as React from 'react'
import hotToast from 'react-hot-toast'

type Variant = 'default' | 'destructive' | 'success'

type Toast = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: Variant
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

  if (variant === 'destructive') return hotToast.error(message)
  if (variant === 'success') return hotToast.success(message)
  return hotToast(message)
}
