import * as React from 'react'
import { useBlocker } from 'react-router'

/**
 * The non-component half of the Header Links / Footer Links machinery.
 *
 * Split from `settings-editor.tsx` because a file that exports both components
 * and plain functions breaks fast refresh — the same reason `banner-labels.ts`
 * is separate from the pages that use it.
 */

export interface SettingsDraft<T> {
  value: T
  set: (next: T) => void
  isDirty: boolean
  /** Throws away local edits and re-seeds from the last saved state. */
  reset: () => void
  /** Call after a successful save so the draft stops counting as dirty. */
  markSaved: (saved: T) => void
}

/**
 * Holds an editable copy of a settings block.
 *
 * Stores only the merchant's OVERRIDE, and derives the displayed value during
 * render as `edited ?? saved ?? loaded ?? fallback`. That ordering is the whole
 * design:
 *
 *  - There is no effect copying `loaded` into state, so the classic bug — a
 *    background refetch resurrecting server values over what someone is
 *    halfway through typing — cannot happen. `edited` wins until they save or
 *    discard.
 *  - `reset` is just dropping the override, so "discard" needs no snapshot.
 *  - Before the query resolves, `loaded` is undefined and the fields render
 *    from `fallback` rather than flickering through a wrong value.
 */
export function useSettingsDraft<T>(loaded: T | undefined, fallback: T): SettingsDraft<T> {
  const [edited, setEdited] = React.useState<T | null>(null)
  const [saved, setSaved] = React.useState<T | null>(null)

  const base = saved ?? loaded ?? fallback
  const value = edited ?? base

  // Structural comparison, not identity: every keystroke rebuilds the row
  // array, so reference equality would report "dirty" the moment a field was
  // edited and then typed back to its original text.
  //
  // Memoized because this runs on every render of a page whose documented caps
  // are 20 nav items each holding 20 children — serializing ~420 objects twice
  // per keystroke, at exactly the size the product advertises as supported.
  const isDirty = React.useMemo(
    () => loaded !== undefined && JSON.stringify(value) !== JSON.stringify(base),
    [loaded, value, base],
  )

  return {
    value,
    set: setEdited,
    isDirty,
    reset: () => setEdited(null),
    markSaved: (next: T) => {
      setSaved(next)
      setEdited(null)
    },
  }
}

/**
 * Blocks an in-app navigation away from unsaved edits, and prompts on a closed
 * tab. Two different mechanisms, neither of which covers the other.
 *
 * Returns the blocker so the caller can render its own dialog — this file
 * deliberately exports no components.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const blocker = useBlocker(
    React.useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty && currentLocation.pathname !== nextLocation.pathname,
      [isDirty],
    ),
  )

  React.useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Browsers show their own wording, but assigning returnValue is still
      // what makes the prompt appear at all.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return blocker
}

/** Moves an item within an array, returning a new one. An out-of-range move is a no-op. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
