/**
 * Selection on the shared table.
 *
 * Two things are being protected here. The first is that roughly 117 pages use
 * this component WITHOUT selection, so the default path must be untouched — no
 * checkbox column, no extra header cell, no changed colSpan.
 *
 * The second is the checkbox-versus-row-click interaction. The orders list
 * navigates on row click, so a checkbox that does not stop propagation opens
 * the order and throws the selection away — the failure most easily introduced
 * by a later refactor, and invisible in any test that only checks state.
 */
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
]

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }]

const baseProps = {
  columns,
  data: rows,
  page: 1,
  pageSize: 10,
  total: 3,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
}

/** Renders with selection wired to real state, as a caller would. */
function SelectableTable({
  onRowClick,
  initial = [],
}: {
  onRowClick?: (row: Row) => void
  initial?: string[]
}) {
  const [selection, setSelection] = React.useState<string[]>(initial)
  return (
    <>
      <div data-testid="selection">{selection.join(',')}</div>
      <DataTable
        {...baseProps}
        selection={selection}
        onSelectionChange={setSelection}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
      />
    </>
  )
}

describe('DataTable without selection props', () => {
  it('renders no checkbox column', () => {
    render(<DataTable {...baseProps} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('renders exactly the caller’s columns', () => {
    render(<DataTable {...baseProps} />)

    // One header cell, because the caller passed one column.
    expect(screen.getAllByRole('columnheader')).toHaveLength(1)
  })

  it('still opens a row on click', async () => {
    const onRowClick = vi.fn()
    render(<DataTable {...baseProps} onRowClick={onRowClick} />)

    await userEvent.click(screen.getByText('Alpha'))

    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })
})

describe('DataTable with selection', () => {
  it('selects an individual row', async () => {
    render(<SelectableTable />)

    await userEvent.click(screen.getByLabelText('Select row b'))

    expect(screen.getByTestId('selection').textContent).toBe('b')
  })

  it('deselects a row that was selected', async () => {
    render(<SelectableTable initial={['b']} />)

    await userEvent.click(screen.getByLabelText('Select row b'))

    expect(screen.getByTestId('selection').textContent).toBe('')
  })

  it('selects every row on the page from the header checkbox', async () => {
    render(<SelectableTable />)

    await userEvent.click(screen.getByLabelText('Select all orders on this page'))

    expect(screen.getByTestId('selection').textContent).toBe('a,b,c')
  })

  it('clears the page from the header checkbox once all are selected', async () => {
    render(<SelectableTable initial={['a', 'b', 'c']} />)

    await userEvent.click(screen.getByLabelText('Select all orders on this page'))

    expect(screen.getByTestId('selection').textContent).toBe('')
  })

  it('adds the checkbox column ahead of the caller’s columns', () => {
    render(<SelectableTable />)

    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
  })

  /*
   * The two that matter most: a checkbox must not navigate, and a row must
   * still navigate. Getting the first wrong makes bulk selection impossible to
   * use — every tick bounces the operator into an order detail page.
   */
  it('does not open the row when its checkbox is clicked', async () => {
    const onRowClick = vi.fn()
    render(<SelectableTable onRowClick={onRowClick} />)

    await userEvent.click(screen.getByLabelText('Select row a'))

    expect(onRowClick).not.toHaveBeenCalled()
    expect(screen.getByTestId('selection').textContent).toBe('a')
  })

  it('does not open a row when the header checkbox is clicked', async () => {
    const onRowClick = vi.fn()
    render(<SelectableTable onRowClick={onRowClick} />)

    await userEvent.click(screen.getByLabelText('Select all orders on this page'))

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('still opens the row when clicked outside the checkbox', async () => {
    const onRowClick = vi.fn()
    render(<SelectableTable onRowClick={onRowClick} />)

    await userEvent.click(screen.getByText('Charlie'))

    expect(onRowClick).toHaveBeenCalledWith(rows[2])
  })

  it('shows the header checkbox as indeterminate on a partial selection', () => {
    render(<SelectableTable initial={['a']} />)

    const header = screen.getByLabelText('Select all orders on this page')
    expect(header.getAttribute('data-state')).toBe('indeterminate')
  })

  it('marks a selected row’s checkbox as checked', () => {
    render(<SelectableTable initial={['b']} />)

    const table = screen.getByRole('table')
    expect(within(table).getByLabelText('Select row b').getAttribute('data-state')).toBe('checked')
    expect(within(table).getByLabelText('Select row a').getAttribute('data-state')).toBe('unchecked')
  })
})
