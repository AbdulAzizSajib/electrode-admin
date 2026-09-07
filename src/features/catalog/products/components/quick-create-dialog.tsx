import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

/**
 * The shell every quick-create on the product form is built from.
 *
 * A merchant who searches the Brand picker for a brand that does not exist has
 * one route forward today: leave a part-filled product, create the brand on its
 * own page, come back, and start over. This is the overlay that removes that —
 * scoped hard by `specs/admin-shell`: reachable only from the field that
 * references the record, create-only, and carrying a subset of the resource's
 * fields. It is an action on the form being filled in, not a return to the
 * authoring overlays `replace-admin-modals-with-pages` removed.
 *
 * The shell owns everything the six bodies share, so each body is its own
 * fields, its own schema and its own create hook, and nothing else.
 */

export interface QuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  submitLabel?: string
  /** A create is in flight: the submit shows it and refuses a second one. */
  pending?: boolean
  /** The backend's reason for refusing, shown without closing the dialog. */
  error?: string | null
  onSubmit: () => void
  children: React.ReactNode
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = 'Create',
  pending = false,
  error,
  onSubmit,
  children,
}: QuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // The product form is what this is rendered over; a click inside the
        // dialog must never read as a click on it.
        onClick={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            /*
             * `DialogContent` portals out of the product form's <form> element,
             * so the DOM tree is safe — but React's synthetic events propagate
             * up the *React* tree, which still runs through the product form's
             * onSubmit. Without this, creating a brand submits a half-filled
             * product. `specs/admin-shell` states it as a requirement.
             */
            event.stopPropagation()
            if (pending) return
            onSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {error && <Alert variant="destructive" title={error} />}

          <div className="flex flex-col gap-3">{children}</div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? 'Creating…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One labelled field inside a quick-create body.
 *
 * The panel's `FormItem`/`FormField` pair is bound to a react-hook-form
 * context; these bodies are half a dozen fields with a single validation rule
 * between them, so they use plain state and this instead of standing up a
 * second form context inside the product form's own.
 */
export function QuickCreateField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
