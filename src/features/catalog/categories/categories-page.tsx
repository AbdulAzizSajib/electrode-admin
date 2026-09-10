import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, FolderTree, CornerDownRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useCategoryTree, useDeleteCategory, type Category } from '@/lib/api/categories'
import { CategoryTreeNode } from '@/features/catalog/categories/category-tree-node'
import { formatDate } from '@/lib/utils/format'

export const CATEGORIES_PATH = '/catalog/categories'

type CategoriesView = 'list' | 'tree'

/**
 * Below this many rows the table shows everything and hides the pager. Set
 * above a typical storefront's category count — a catalogue is a few dozen
 * headings, not a product list — so the common case is one uninterrupted
 * hierarchy. See `paginated` below for why a break mid-hierarchy is worse here
 * than a long page.
 */
const PAGINATE_ABOVE = 50

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [view, setView] = React.useState<CategoriesView>('list')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  /*
   * One request, not two.
   *
   * Both views are built from the tree endpoint, which returns the whole
   * hierarchy in one unpaginated response — that is what lets the table order
   * rows depth-first and indent them, so filtering and paging happen here, over
   * that same array, for the row order to survive.
   *
   * The flat `useCategories()` list used to be fetched alongside it and had
   * shrunk to serving two things, both of which were wrong: a Parent column that
   * restated the indentation, and a fallback that rendered the catalogue
   * *unindented* for as long as the tree was in flight — a visibly wrong
   * hierarchy where a skeleton belongs. Removing them removes the request.
   */
  const treeQuery = useCategoryTree()
  const deleteMutation = useDeleteCategory()
  const confirmDialog = useConfirmDialog()

  // Depth-first ordering with each row's nesting depth, derived from the tree endpoint — lets the
  // flat table read as a hierarchy (parent immediately followed by its children, indented) instead
  // of an unordered list where you can't tell what's nested under what.
  type CategoryRow = Category & { depth: number }
  const orderedRows = React.useMemo(() => {
    const out: CategoryRow[] = []
    const walk = (nodes: Category[], depth: number) => {
      for (const node of nodes) {
        out.push({ ...node, depth })
        if (node.children?.length) walk(node.children, depth + 1)
      }
    }
    walk(treeQuery.data ?? [], 0)
    return out
  }, [treeQuery.data])

  // Search filters by name/slug across the whole hierarchy, keeping depth-first order among matches.
  const visibleRows = React.useMemo(() => {
    if (!search.trim()) return orderedRows
    const needle = search.trim().toLowerCase()
    return orderedRows.filter((c) => c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle))
  }, [orderedRows, search])

  const handleDelete = (category: Category) => {
    confirmDialog.confirm(async () => {
      try {
        await deleteMutation.mutateAsync(category.id)
        toast({ title: 'Category deleted' })
      } catch (err) {
        toast({ title: 'Could not delete category', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
      }
    })
  }

  /*
   * Paging is only applied once there is enough to page.
   *
   * A page break inside a hierarchy severs the one relationship this table
   * exists to show: "Cables" is meaningful because "Adapter & Cables" is the row
   * above it, and at ten-per-page a parent can end a page with its children
   * stranded at the top of the next one, still indented, now under nothing. The
   * catalogue this runs against is fifteen rows, so that break bought a second
   * page and cost the hierarchy on both.
   *
   * Past the threshold paging returns, because an unbounded table is its own
   * problem — but the pager is then a real one over a list long enough that the
   * merchant is scrolling anyway.
   */
  const paginated = visibleRows.length > PAGINATE_ABOVE
  const filteredPage = React.useMemo(
    () => (paginated ? visibleRows.slice((page - 1) * pageSize, page * pageSize) : visibleRows),
    [visibleRows, page, pageSize, paginated],
  )

  /*
   * Every column is unsortable, deliberately.
   *
   * `DataTable` turns any sortable header into a live sort button, and this
   * table's rows are not a list — they are a hierarchy flattened depth-first,
   * where a child's only claim to meaning is that it sits directly under its
   * parent. Sorting by slug or status reorders that into a sequence where the
   * indentation still says "child of the row above" while pointing at whatever
   * row the sort happened to leave there.
   *
   * It was also sorting one sliced page rather than the catalogue, so the arrows
   * offered an operation that was wrong twice over. The tree endpoint returns
   * `sortOrder` order; that ordering is the answer, so the controls to override
   * it are gone rather than disabled.
   */
  const columns: ColumnDef<CategoryRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: false,
      cell: ({ row }) => (
        <div
          className="flex items-center gap-1.5"
          // Indent is proportional to depth and so cannot come from a fixed
          // class; `--spacing` keeps it on the panel's compact scale rather than
          // a hardcoded pixel step.
          style={{ paddingInlineStart: `calc(var(--spacing) * 5 * ${row.original.depth})` }}
        >
          {row.original.depth > 0 && (
            <CornerDownRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      enableSorting: false,
      // The storefront address, so it reads as an address rather than as a
      // second name: tabular figures, and the muted weight it already had.
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">/{row.original.slug}</span>
      ),
    },
    /*
     * There is no Parent column.
     *
     * It restated what the Name column already shows: a child row is indented
     * under its parent and carries a turn-down arrow, so naming the parent again
     * one column over is the same fact twice — and it was the widest thing on
     * the row, pushing Status and Created toward the edge on a laptop.
     */
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <Badge variant={row.original.status ? 'success' : 'secondary'}>{row.original.status ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
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
            <DropdownMenuItem onClick={() => navigate(`${CATEGORIES_PATH}/${row.original.id}`)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => handleDelete(row.original)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Categories"
        description="Organize your catalog into browsable categories."
        actions={
          <Button size="lg" onClick={() => navigate(`${CATEGORIES_PATH}/new`)}>
            <Plus /> New category
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as CategoriesView)}>
          {/* A segmented control, as on the dashboard's reporting period — there
              is no `TabsContent`, so the list it switches needs naming here or a
              screen reader announces two unlabelled buttons. */}
          <TabsList aria-label="Category view">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="tree">Tree</TabsTrigger>
          </TabsList>
        </Tabs>

        {/*
         * The size of the catalogue, which the pager used to be the only thing
         * saying. Now that the pager is hidden whenever everything fits, it is
         * stated here instead — and it stays honest while searching, where the
         * count of matches is the thing being looked for.
         *
         * `aria-live` because filtering happens as you type with no other
         * announcement: without it a screen-reader user gets no feedback that
         * the table under the box just changed.
         */}
        {!treeQuery.isLoading && !treeQuery.isError && orderedRows.length > 0 && (
          <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {search.trim()
              ? `${visibleRows.length} of ${orderedRows.length} ${orderedRows.length === 1 ? 'category' : 'categories'}`
              : `${orderedRows.length} ${orderedRows.length === 1 ? 'category' : 'categories'}`}
          </p>
        )}
      </div>

      {view === 'list' ? (
        <DataTable
          columns={columns}
          data={filteredPage}
          isLoading={treeQuery.isLoading}
          isError={treeQuery.isError}
          onRetry={() => treeQuery.refetch()}
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Search categories…"
          // A search that matched nothing is not an empty catalogue — offering
          // "create your first category" to someone with 40 of them who mistyped
          // one is the wrong next step.
          emptyState={
            search.trim()
              ? {
                  icon: FolderTree,
                  title: `No categories match “${search.trim()}”`,
                  description: 'Check the spelling, or search by slug instead of name.',
                  action: (
                    <Button size="lg" variant="outline" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                  ),
                }
              : {
                  icon: FolderTree,
                  title: 'No categories yet',
                  description: 'Create your first category to start organizing products.',
                  action: (
                    <Button size="lg" onClick={() => navigate(`${CATEGORIES_PATH}/new`)}>
                      <Plus /> New category
                    </Button>
                  ),
                }
          }
          // Under the threshold every row is already on screen, so the pager
          // describes one full page rather than offering to slice the hierarchy.
          page={paginated ? page : 1}
          pageSize={paginated ? pageSize : Math.max(visibleRows.length, 1)}
          total={visibleRows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          hidePagerWhenSinglePage
        />
      ) : treeQuery.isLoading ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : treeQuery.isError ? (
        <EmptyState
          title="Could not load category tree"
          description="Something went wrong while fetching categories."
          action={
            <Button size="lg" variant="outline" onClick={() => treeQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !treeQuery.data || treeQuery.data.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create your first category to start organizing products."
          action={
            <Button size="lg" onClick={() => navigate(`${CATEGORIES_PATH}/new`)}>
              <Plus /> New category
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border border-border bg-surface p-2">
          {treeQuery.data.map((root) => (
            <CategoryTreeNode
              key={root.id}
              category={root}
              depth={0}
              onEdit={(cat) => navigate(`${CATEGORIES_PATH}/${cat.id}`)}
              // The chosen parent rides in the URL, so reloading the create page
              // or sharing the link still opens under the same parent.
              onAddChild={(parent) => navigate(`${CATEGORIES_PATH}/new?parentId=${parent.id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this category?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
