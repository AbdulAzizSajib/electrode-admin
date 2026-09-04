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
import { useCategories, useCategoryTree, useDeleteCategory, type Category } from '@/lib/api/categories'
import { CategoryTreeNode } from '@/features/catalog/categories/category-tree-node'
import { formatDate } from '@/lib/utils/format'

export const CATEGORIES_PATH = '/catalog/categories'

type CategoriesView = 'list' | 'tree'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [view, setView] = React.useState<CategoriesView>('list')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCategories({ search })
  const treeQuery = useCategoryTree()
  const deleteMutation = useDeleteCategory()
  const confirmDialog = useConfirmDialog()

  const all = React.useMemo(() => data?.data ?? [], [data])
  const parentName = (id: string | null) => all.find((c) => c.id === id)?.name ?? '—'

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
    // Fall back to the flat (unordered) list while the tree hasn't loaded yet, so the table isn't
    // empty just because the second query is slower.
    return out.length > 0 ? out : all.map((c) => ({ ...c, depth: 0 }))
  }, [treeQuery.data, all])

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

  const filteredPage = React.useMemo(() => visibleRows.slice((page - 1) * pageSize, page * pageSize), [visibleRows, page, pageSize])

  const columns: ColumnDef<CategoryRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.original.depth * 20}px` }}>
          {row.original.depth > 0 && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'slug', header: 'Slug', cell: ({ row }) => <span className="text-muted-foreground">{row.original.slug}</span> },
    {
      id: 'parent',
      header: 'Parent',
      cell: ({ row }) => (row.original.parentId ? <Badge variant="outline">{parentName(row.original.parentId)}</Badge> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.status ? 'success' : 'secondary'}>{row.original.status ? 'Active' : 'Inactive'}</Badge>,
    },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'actions',
      header: '',
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
          <Button size="sm" onClick={() => navigate(`${CATEGORIES_PATH}/new`)}>
            <Plus /> New category
          </Button>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as CategoriesView)}>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="tree">Tree</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'list' ? (
        <DataTable
          columns={columns}
          data={filteredPage}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          searchPlaceholder="Search categories…"
          emptyState={{ icon: FolderTree, title: 'No categories yet', description: 'Create your first category to start organizing products.' }}
          page={page}
          pageSize={pageSize}
          total={visibleRows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
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
            <Button size="sm" variant="outline" onClick={() => treeQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !treeQuery.data || treeQuery.data.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Create your first category to start organizing products." />
      ) : (
        <div className="rounded-md border border-border p-2">
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
