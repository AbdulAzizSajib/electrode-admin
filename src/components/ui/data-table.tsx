import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataPagination } from '@/components/ui/pagination'
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  emptyState?: Partial<EmptyStateProps>
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRowClick?: (row: TData) => void
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  /**
   * Row selection — entirely opt-in.
   *
   * Roughly 117 pages share this component and only the orders list wants
   * selection, so absent these three props nothing about the table changes: no
   * checkbox column, no header checkbox, no behavioural difference.
   *
   * The state lives with the caller rather than inside the table, for the same
   * reason sorting and pagination already do — the page is what renders a bulk
   * action bar from it, and a ref could not drive that.
   * See openspec/changes/add-steadfast-courier-integration-admin, design.md Decision 1.
   */
  selection?: string[]
  onSelectionChange?: (selection: string[]) => void
  /** Stable id per row. Required for selection; ignored without it. */
  getRowId?: (row: TData) => string
  /**
   * Hides the pager while everything fits on one page.
   *
   * Opt-in rather than the default: for most of the panel's lists the row of
   * "Showing 1–7 of 7" and a rows-per-page select is useful furniture even when
   * it has nothing to page, and removing it everywhere would make short and long
   * lists look like different components. The categories table asks for it
   * because its rows are a hierarchy — see that page's `PAGINATE_ABOVE`.
   */
  hidePagerWhenSinglePage?: boolean
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  isError,
  errorMessage = 'Something went wrong while loading this data.',
  onRetry,
  emptyState,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  toolbar,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  sorting: controlledSorting,
  onSortingChange,
  selection,
  onSelectionChange,
  getRowId,
  hidePagerWhenSinglePage = false,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting

  const selectionEnabled =
    selection !== undefined && onSelectionChange !== undefined && getRowId !== undefined

  const selected = React.useMemo(() => new Set(selection ?? []), [selection])

  const pageIds = React.useMemo(
    () => (selectionEnabled ? data.map((row) => getRowId(row)) : []),
    [data, getRowId, selectionEnabled],
  )

  // "All" means all of THIS page. Selection is deliberately page-scoped — see
  // the caller, which clears it whenever the page or filter changes.
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPageSelected = pageIds.some((id) => selected.has(id))

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange([...next])
  }

  const togglePage = () => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
    else pageIds.forEach((id) => next.add(id))
    onSelectionChange([...next])
  }

  /**
   * The checkbox column, prepended only when selection is on.
   *
   * `stopPropagation` on the cell is the whole reason this is a hand-built
   * column rather than a plain cell renderer: the orders list navigates on row
   * click, so without it ticking a box opens the order and throws the selection
   * away. It is the interaction most easily got wrong here.
   */
  const selectionColumn: ColumnDef<TData> = {
    id: '__select',
    enableSorting: false,
    header: () => (
      <span
        onClick={(e) => e.stopPropagation()}
        role="presentation"
        className="flex items-center"
      >
        <Checkbox
          checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
          onCheckedChange={togglePage}
          aria-label="Select all orders on this page"
        />
      </span>
    ),
    cell: ({ row }) => {
      const id = getRowId!(row.original)
      return (
        <span
          onClick={(e) => e.stopPropagation()}
          role="presentation"
          className="flex items-center"
        >
          <Checkbox
            checked={selected.has(id)}
            onCheckedChange={() => toggleRow(id)}
            aria-label={`Select row ${id}`}
          />
        </span>
      )
    },
  }

  const tableColumns = React.useMemo(
    () => (selectionEnabled ? [selectionColumn, ...columns] : columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, selectionEnabled, selection, data],
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (onSortingChange) onSortingChange(next)
      else setInternalSorting(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  })

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const hasToolbar = onSearchChange !== undefined || toolbar !== undefined

  return (
    <div className="flex flex-col gap-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange !== undefined && (
            <Input
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 max-w-64"
            />
          )}
          {toolbar}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDir = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground text-sm py-2 px-1.5 font-medium text-muted-foreground transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        /*
                         * An unsortable header renders as a plain span, NOT a
                         * disabled button.
                         *
                         * A disabled <button> swallows every click on its
                         * children, so the select-all checkbox nested in this
                         * header silently did nothing while the per-row ones
                         * worked. Wrapping non-interactive text in a disabled
                         * button was never meaningful markup anyway; the classes
                         * are carried across so layout is identical everywhere
                         * else this component is used.
                         */
                        <span className="inline-flex items-center gap-1 cursor-default text-sm py-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {tableColumns.map((_, ci) => (
                    <TableCell key={ci}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={tableColumns.length} className="py-8">
                  <ErrorState description={errorMessage} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={tableColumns.length} className="py-8">
                  <EmptyState
                    title={emptyState?.title ?? 'No results'}
                    description={emptyState?.description ?? 'There is nothing here yet.'}
                    icon={emptyState?.icon}
                    action={emptyState?.action}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isError && !(hidePagerWhenSinglePage && pageCount <= 1) && (
        <DataPagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
