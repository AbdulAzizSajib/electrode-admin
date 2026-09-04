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
  children: React.ReactNode
  removeLabel?: string
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border p-2.5 ${
        error ? 'border-destructive' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Move up"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Move down"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{title}</span>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
        {onAdd &&
          (atCapacity ? (
            <span className="max-w-64 text-right text-xs text-muted-foreground">{capacityNote}</span>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={onAdd}>
              <Plus /> {addLabel ?? 'Add'}
            </Button>
          ))}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  )
}

/** The sticky footer both editors share: dirty indicator, discard, save. */
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
      {isDirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
      <Button variant="outline" onClick={onReset} disabled={!isDirty || isSaving}>
        Discard
      </Button>
      <Button onClick={onSave} disabled={!isDirty || isSaving}>
        {isSaving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
