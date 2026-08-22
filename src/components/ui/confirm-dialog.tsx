import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button, type ButtonProps } from '@/components/ui/button'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ButtonProps['variant']
  loading?: boolean
  onConfirm: () => void
}

/** Shared confirmation dialog for destructive or state-changing actions (delete, cancel, etc.). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Convenience hook for wiring up a single confirm dialog instance imperatively. */
export function useConfirmDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const actionRef = React.useRef<(() => void | Promise<void>) | null>(null)

  const confirm = (action: () => void | Promise<void>) => {
    actionRef.current = action
    setOpen(true)
  }

  const handleConfirm = async () => {
    if (!actionRef.current) return
    setPending(true)
    try {
      await actionRef.current()
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return { open, setOpen, pending, confirm, handleConfirm }
}
