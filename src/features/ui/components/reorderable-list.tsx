import * as React from 'react'
import { moveItem } from '@/features/ui/components/settings-editor-utils'

/**
 * Drag-to-reorder over the native HTML5 API, for any list of items.
 *
 * Lifted here out of `home-slider/home-slider-page.tsx`, which wrote it against
 * `Banner[]` when the hero slots were the panel's only sortable surface. Home
 * Sections is the second, so it is generalised rather than copied — the drag
 * bookkeeping is identical and two copies would drift.
 *
 * STILL NO DRAG LIBRARY. The original note holds: this is a handful of rows on
 * two screens, and the native API covers it in ~30 lines. A dependency would be
 * carried by the whole bundle to serve them.
 *
 * ── Drag is the fast path, never the only one ────────────────────────────
 *
 * Native HTML5 drag is not operable by keyboard and is unreliable under touch,
 * and merchants administer this panel from tablets. So a caller MUST also give
 * each row an explicit move control — the up/down buttons `settings-editor.tsx`
 * already renders for header and footer links. This component deliberately does
 * not render those itself: it does not own the row's layout, and a caller that
 * forgets them has shipped a list some of its users cannot reorder at all.
 *
 * See openspec/changes/add-homepage-section-toggles, design.md Decision 7.
 */
export interface DragHandleProps {
  draggable: true
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

export function ReorderableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
  className,
  trailing,
}: {
  items: T[]
  /** Stable identity per item — React keys, so not the array index. */
  getKey: (item: T) => string
  /** Called with the fully reordered array, so the caller can persist it. */
  onReorder: (ordered: T[]) => void
  renderItem: (item: T, dragHandleProps: DragHandleProps, index: number) => React.ReactNode
  className?: string
  trailing?: React.ReactNode
}) {
  // State rather than a ref: the rows re-render on drag anyway, and a ref read
  // while building these handlers would be a render-time ref access.
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const makeHandleProps = (index: number): DragHandleProps => ({
    draggable: true,
    onDragStart: () => setDragIndex(index),
    // Without preventDefault the browser refuses the drop outright — the
    // default for a dragover is "not a valid target".
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      setDragIndex(null)
      if (dragIndex === null || dragIndex === index) return
      onReorder(moveItem(items, dragIndex, index))
    },
    onDragEnd: () => setDragIndex(null),
  })

  return (
    <div className={className}>
      {items.map((item, index) => (
        <React.Fragment key={getKey(item)}>
          {renderItem(item, makeHandleProps(index), index)}
        </React.Fragment>
      ))}
      {trailing}
    </div>
  )
}
