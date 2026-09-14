import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { moveItem } from './settings-editor-utils'
import { ReorderableList } from './reorderable-list'

/**
 * `moveItem` is the ordering rule every reorderable surface in the panel shares
 * — Header Links, Footer Links, the hero slots and Home Sections all reduce to
 * it. A silent off-by-one here reorders a merchant's homepage wrongly and looks
 * like the drag "not taking", so the arithmetic is pinned directly rather than
 * only through a component.
 */
describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd']

  it('moves an item up', () => {
    expect(moveItem(items, 2, 1)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves an item down', () => {
    expect(moveItem(items, 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('moves an item to the end', () => {
    expect(moveItem(items, 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves an item to the front', () => {
    expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('is a no-op when an item is moved onto itself', () => {
    expect(moveItem(items, 2, 2)).toEqual(items)
  })

  it('is a no-op for an out-of-range destination', () => {
    expect(moveItem(items, 0, 4)).toEqual(items)
    expect(moveItem(items, 0, -1)).toEqual(items)
  })

  it('does not mutate the array it was given', () => {
    const original = [...items]
    moveItem(items, 0, 3)
    expect(items).toEqual(original)
  })
})

/**
 * The drag bookkeeping itself. Worth a test despite being short, because the
 * failure modes are silent: a missing `preventDefault` on dragover makes the
 * browser reject every drop (the row simply never moves), and a stale
 * `dragIndex` reorders the wrong row.
 */
describe('ReorderableList', () => {
  function Harness({ onReorder }: { onReorder: (ordered: string[]) => void }) {
    const items = ['a', 'b', 'c']

    return (
      <ReorderableList
        items={items}
        getKey={(item) => item}
        onReorder={onReorder}
        renderItem={(item, dragHandleProps) => (
          <div {...dragHandleProps} data-testid={`row-${item}`}>
            {item}
          </div>
        )}
      />
    )
  }

  it('reports the reordered array after a drag and drop', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    fireEvent.dragStart(screen.getByTestId('row-a'))
    fireEvent.dragOver(screen.getByTestId('row-c'))
    fireEvent.drop(screen.getByTestId('row-c'))

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })

  it('does not fire when a row is dropped on itself', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    fireEvent.dragStart(screen.getByTestId('row-b'))
    fireEvent.drop(screen.getByTestId('row-b'))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('does not fire for a drop with no drag in progress', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    fireEvent.drop(screen.getByTestId('row-c'))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('clears the drag once it ends, so the next drop is not misattributed', () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)

    fireEvent.dragStart(screen.getByTestId('row-a'))
    fireEvent.dragEnd(screen.getByTestId('row-a'))
    fireEvent.drop(screen.getByTestId('row-c'))

    expect(onReorder).not.toHaveBeenCalled()
  })
})
