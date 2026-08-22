import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, AlertTriangle } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataPagination } from '@/components/ui/pagination'
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting

  const table = useReactTable({
    data,
    columns,
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

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sortDir = header.column.getIsSorted()
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1',
                          canSort ? 'cursor-pointer select-none hover:text-foreground' : 'cursor-default',
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        disabled={!canSort}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          ))}
                      </button>
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
                {columns.map((_, ci) => (
                  <TableCell key={ci}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : isError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-8">
                <EmptyState
                  icon={AlertTriangle}
                  title="Couldn't load data"
                  description={errorMessage}
                  action={
                    onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Try again
                      </button>
                    )
                  }
                />
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-8">
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

      {!isError && (
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
