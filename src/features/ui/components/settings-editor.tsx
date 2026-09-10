import * as React from 'react'
import type { Blocker } from 'react-router'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * The shared presentation behind the Header Links and Footer Links editors.
 *
 * Both are the same shape of surface: load a settings block, let the merchant
 * restructure a list of typed rows, preview it, and save only their own fields.
 * The hooks and helpers those pages also need live in
 * `settings-editor-utils.tsx` — a file exporting both components and plain
 * functions breaks fast refresh.
 */

/** Renders the prompt for the blocker returned by `useUnsavedChangesGuard`. */
export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  if (blocker.state !== 'blocked') return null

  return (
    <Dialog open onOpenChange={() => blocker.reset?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            Your changes to this page have not been saved. Leaving now discards them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One editable row with its reorder and remove controls.
 *
 * `error` is per-row on purpose: a save that fails because one nav item is
 * missing an href must point at THAT item. A single banner saying "check your
 * links" leaves the merchant comparing twenty rows by eye.
 *
 * That reasoning only pays off if the pointing survives past the eye. The row
 * renders the message with `role="alert"` and hands `children` the id of that
 * message, so a caller can point the failing field at it with
 * `aria-describedby` and mark it `aria-invalid`. Without that the merchant
 * hears "Fix the highlighted rows first" — *highlighted* being an instruction
 * only a sighted user can follow — and then tabs twenty rows to find it.
 *
 * The controls match `landing-page-lists.tsx`, which is the same three buttons
 * with the same labels: unmodified `size="icon"` (32px, not the 28px this had),
 * `size-4` glyphs, and a tinted destructive hover. PRODUCT.md names tablet as
 * the primary scene, so these are touch targets, and Remove sits directly under
 * Move-down — `mt-1` buys the destructive control separation the stack lacked.
 */
export function EditorRow({
  index,
  count,
  onMove,
  onRemove,
  error,
  children,
  removeLabel = 'Remove',
}: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
  error?: string
  /** Receives the error message's id, or undefined when the row is valid. */
  children: React.ReactNode | ((errorId: string | undefined) => React.ReactNode)
  removeLabel?: string
}) {
  const errorId = `${React.useId()}-error`

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border p-2.5 ${
        error ? 'border-destructive' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {typeof children === 'function' ? children(error ? errorId : undefined) : children}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Move up"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Move down"
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="mt-1 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The heading-plus-add-control pairing shared by a section and any list nested
 * inside one.
 *
 * Split out because the announcement bar's link list hand-rolled this: a
 * `<Label>` with no control (invalid markup) beside a bare button, placed in
 * the section BODY while the sibling list's identical control sat in the
 * section HEADER. Two structurally identical lists offered their primary action
 * in two different places on one screen, and the copy was the one that would
 * drift when this changed.
 */
function EditorHeading({
  title,
  description,
  onAdd,
  addLabel,
  atCapacity,
  capacityNote,
  as: Title = 'span',
  className,
}: {
  title: string
  description?: string
  onAdd?: () => void
  addLabel?: string
  atCapacity?: boolean
  capacityNote?: string
  as?: 'span'
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-2 ${className ?? ''}`}>
      <div className="flex flex-col gap-0.5">
        <Title className="font-medium text-foreground">{title}</Title>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {onAdd &&
        (atCapacity ? (
          <span className="max-w-64 text-right text-xs text-muted-foreground">{capacityNote}</span>
        ) : (
          <Button type="button" size="lg" variant="outline" onClick={onAdd}>
            <Plus /> {addLabel ?? 'Add'}
          </Button>
        ))}
    </div>
  )
}

/** A titled group of rows with its add button and cap. */
export function EditorSection({
  title,
  description,
  onAdd,
  addLabel,
  atCapacity,
  capacityNote,
  children,
}: {
  title: string
  description?: string
  onAdd?: () => void
  addLabel?: string
  atCapacity?: boolean
  capacityNote?: string
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <EditorHeading
        title={title}
        description={description}
        onAdd={onAdd}
        addLabel={addLabel}
        atCapacity={atCapacity}
        capacityNote={capacityNote}
      />
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  )
}

/**
 * A list nested inside a section, carrying the same add control and cap as the
 * section itself.
 *
 * Same affordance, one level down — so a merchant learns "the add button sits
 * at the top-right of the thing it adds to" once and it holds everywhere.
 */
export function EditorSubsection({
  title,
  description,
  onAdd,
  addLabel,
  atCapacity,
  capacityNote,
  children,
}: {
  title: string
  description?: string
  onAdd?: () => void
  addLabel?: string
  atCapacity?: boolean
  capacityNote?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <EditorHeading
        title={title}
        description={description}
        onAdd={onAdd}
        addLabel={addLabel}
        atCapacity={atCapacity}
        capacityNote={capacityNote}
      />
      {children}
    </div>
  )
}

/**
 * The sticky footer both editors share: dirty indicator, discard, save.
 *
 * `loading` on the save button rather than only swapping its label: the label
 * swap alone moves nothing on a fast save and everything on a slow one, so the
 * merchant's evidence that a click registered was a word changing width. The
 * primitive already ships a spinner for this; it was simply never asked for.
 *
 * `aria-live="polite"` on the dirty indicator, because "Unsaved changes"
 * appearing and then disappearing on save is the page's only running commentary
 * on whether the merchant's work is safe, and a screen reader user otherwise
 * gets none of it.
 */
export function EditorActions({
  isDirty,
  isSaving,
  onReset,
  onSave,
}: {
  isDirty: boolean
  isSaving: boolean
  onReset: () => void
  onSave: () => void
}) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
      <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
        {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : ''}
      </span>
      <Button variant="outline" onClick={onReset} disabled={!isDirty || isSaving}>
        Discard
      </Button>
      <Button onClick={onSave} loading={isSaving} disabled={!isDirty}>
        {isSaving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
