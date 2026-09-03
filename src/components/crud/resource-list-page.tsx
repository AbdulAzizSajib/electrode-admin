import * as React from 'react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { ReassignDeleteDialog, type ReassignOption } from '@/components/crud/reassign-delete-dialog'
import { ApiError, type PaginatedResponse } from '@/lib/api/client'

/**
 * The list half of the shared CRUD scaffolding.
 *
 * There are nine near-identical catalogue surfaces in this panel — attributes,
 * sub-categories, tax rules, shipping rules, collections, bundle deals and the
 * rest. Written one at a time they drift: one paginates, another does not; one
 * confirms a delete, another does not; the third reports an error as a toast
 * and the fourth swallows it. This component is the single place all of that is
 * decided, so a page is a column list and a query rather than a copy of the
 * page before it.
 *
 * See align-admin-catalog-with-reference — design.md, "Nine new CRUD surfaces
 * is a lot of near-identical code".
 */

/** What the shared page needs from a resource's list query hook. */
export interface ResourceListQuery<T> {
  data?: PaginatedResponse<T>
  isLoading: boolean
  isError: boolean
  refetch: () => unknown
}

export interface ResourceListParams {
  search: string
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * How deleting this resource behaves.
 *
 * The three modes exist because the backend genuinely refuses in three
 * different ways, and each refusal needs a different next step from the
 * merchant. Crucially, *whether* something is in use is never decided here —
 * the server decides, refuses, and this reacts to the refusal. Duplicating the
 * "is it in use" check in the browser would give two answers that can disagree.
 */
export type ResourceDeleteMode =
  /** Nothing else references it. Confirm and delete. */
  | 'simple'
  /**
   * Products must always have one of these (tax rules, shipping rules). The
   * first attempt is refused with a count; the merchant then picks a
   * replacement and the retry carries it.
   */
  | 'reassign'
  /**
   * Products reference it optionally (bundle deals). The first attempt is
   * refused with a count; the retry carries `force` and the products are left
   * without one.
   */
  | 'confirm'

export interface ResourceDeleteConfig<T> {
  mode: ResourceDeleteMode
  /** Performs the delete. `reassignToId`/`force` are only sent on a retry. */
  remove: (args: { id: string; reassignToId?: string; force?: boolean }) => Promise<unknown>
  /** Only for `reassign`: where the affected records may be moved to. */
  reassignOptions?: (row: T) => ReassignOption[]
  /** Label for the replacement picker, e.g. "Move those products to". */
  reassignLabel?: string
  /** Overrides the plain "Delete this X?" prompt shown before the first attempt. */
  confirmDescription?: React.ReactNode
}

export interface ResourceListPageProps<T> {
  title: string
  description?: string
  /** Shown in the empty state. */
  icon?: LucideIcon
  emptyTitle: string
  emptyDescription: string
  searchPlaceholder?: string

  /** Columns excluding the row-actions column, which is appended here. */
  columns: ColumnDef<T>[]
  /** The resource's list hook, called with the page's current search/paging. */
  useList: (params: ResourceListParams) => ResourceListQuery<T>

  getRowId: (row: T) => string
  /** Names the row in confirmations and toasts, so a prompt is never "Delete this?". */
  getRowLabel: (row: T) => string
  /** Singular, lowercase — "tax rule". Used to build prompts and messages. */
  noun: string

  onCreate?: () => void
  createLabel?: string
  onEdit?: (row: T) => void
  /** Extra items appended to each row's action menu. */
  rowActions?: (row: T) => React.ReactNode
  /** Extra controls beside the search box. */
  toolbar?: React.ReactNode
  /** Rendered below the table — where a page's own modals go. */
  children?: React.ReactNode

  remove?: ResourceDeleteConfig<T>
  defaultPageSize?: number
}

/** What the delete flow is currently waiting on, if anything. */
type DeleteState<T> =
  | { phase: 'idle' }
  | { phase: 'confirm'; row: T }
  /** The server refused; `reason` is its own message, which names the count. */
  | { phase: 'blocked'; row: T; reason: string }

export function ResourceListPage<T>({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  columns,
  useList,
  getRowId,
  getRowLabel,
  noun,
  onCreate,
  createLabel,
  onEdit,
  rowActions,
  toolbar,
  children,
  remove,
  defaultPageSize = 10,
}: ResourceListPageProps<T>) {
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [deleteState, setDeleteState] = React.useState<DeleteState<T>>({ phase: 'idle' })
  const [pending, setPending] = React.useState(false)

  // Sorting is server-side: these lists are paginated by the backend, so
  // reordering in the browser would only reorder the page already fetched.
  const sort = sorting[0]
  const query = useList({
    search,
    page,
    limit: pageSize,
    sortBy: sort?.id,
    sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
  })

  const closeDelete = () => setDeleteState({ phase: 'idle' })

  /**
   * Runs a delete attempt. A 409 is not a failure to report and forget — it is
   * the server telling us what the merchant has to decide first, so it moves
   * the flow on rather than ending it.
   */
  const attemptDelete = async (row: T, args: { reassignToId?: string; force?: boolean } = {}) => {
    if (!remove) return
    setPending(true)
    try {
      await remove.remove({ id: getRowId(row), ...args })
      toast({ title: `${getRowLabel(row)} deleted` })
      closeDelete()
    } catch (err) {
      const isInUse = err instanceof ApiError && err.status === 409 && remove.mode !== 'simple'
      if (isInUse) {
        setDeleteState({ phase: 'blocked', row, reason: err.message })
      } else {
        toast({
          title: `Could not delete this ${noun}`,
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        })
      }
    } finally {
      setPending(false)
    }
  }

  const actionsColumn: ColumnDef<T> = {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {rowActions?.(row.original)}
          {remove && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteState({ phase: 'confirm', row: row.original })}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }

  const blocked = deleteState.phase === 'blocked' ? deleteState : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          onCreate && (
            <Button size="sm" onClick={onCreate}>
              <Plus /> {createLabel ?? `New ${noun}`}
            </Button>
          )
        }
      />

      <DataTable
        columns={[...columns, actionsColumn]}
        data={query.data?.data ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder={searchPlaceholder ?? `Search ${title.toLowerCase()}…`}
        toolbar={toolbar}
        emptyState={{ icon, title: emptyTitle, description: emptyDescription }}
        sorting={sorting}
        onSortingChange={(next) => {
          setSorting(next)
          setPage(1)
        }}
        page={page}
        pageSize={pageSize}
        total={query.data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {children}

      <ConfirmDialog
        open={deleteState.phase === 'confirm'}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={
          deleteState.phase === 'confirm'
            ? `Delete ${getRowLabel(deleteState.row)}?`
            : `Delete this ${noun}?`
        }
        description={remove?.confirmDescription ?? 'This cannot be undone.'}
        confirmLabel="Delete"
        loading={pending}
        onConfirm={() => {
          if (deleteState.phase === 'confirm') void attemptDelete(deleteState.row)
        }}
      />

      {/* The server refused the first attempt. What happens next depends on
          whether the records it named must keep one of these or may simply go
          without. */}
      {blocked && remove && (
        <ReassignDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) closeDelete()
          }}
          title={`${getRowLabel(blocked.row)} is still in use`}
          reason={blocked.reason}
          mode={remove.mode === 'reassign' ? 'reassign' : 'confirm'}
          reassignLabel={remove.reassignLabel ?? 'Move them to'}
          options={
            remove
              .reassignOptions?.(blocked.row)
              .filter((option) => option.value !== getRowId(blocked.row)) ?? []
          }
          loading={pending}
          onConfirm={(reassignToId) =>
            void attemptDelete(
              blocked.row,
              remove.mode === 'reassign' ? { reassignToId } : { force: true },
            )
          }
        />
      )}
    </div>
  )
}
