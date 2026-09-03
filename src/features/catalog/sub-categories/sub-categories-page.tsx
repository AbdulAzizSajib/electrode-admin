import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FolderTree } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ResourceListPage, type ResourceListParams } from '@/components/crud/resource-list-page'
import {
  CategoryCreateModal,
  CategoryEditModal,
} from '@/features/catalog/categories/category-form-modal'
import {
  useCategories,
  useCategoryTree,
  useDeleteCategory,
  type Category,
} from '@/lib/api/categories'
import { formatDate } from '@/lib/utils/format'

export const SUB_CATEGORIES_PATH = '/catalog/sub-categories'

/**
 * Sub-categories are not a new model — the hierarchy has always lived on
 * `Category.parentId`, and the backend's admin list already filters by it. What
 * was missing is a surface: reaching a sub-category meant opening its parent
 * and editing a field. This page is that surface and nothing more.
 *
 * It reuses the category modals rather than growing its own: a sub-category is
 * a category, and two forms for one record is how the two drift apart.
 */
export default function SubCategoriesPage() {
  const { data: tree = [] } = useCategoryTree()
  const [parentId, setParentId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const deleteMutation = useDeleteCategory()

  // Default to the first parent that actually has children, so the page opens
  // on something rather than on an empty list the merchant has to explain to
  // themselves.
  const effectiveParentId = parentId ?? tree.find((c) => c.children?.length)?.id ?? tree[0]?.id ?? null

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: 'Sub category',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.slug}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status ? 'success' : 'secondary'}>
          {row.original.status ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { accessorKey: 'sortOrder', header: 'Order' },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ]

  // Wrapping the shared hook so the page's parent filter rides along with the
  // search and paging the list page owns.
  const useList = (params: ResourceListParams) =>
    useCategories({
      ...params,
      parentId: effectiveParentId ?? undefined,
      // Without a parent chosen there is nothing to list; asking would return
      // every top-level category, which is the other page.
      limit: effectiveParentId ? params.limit : 0,
    })

  const parentName = tree.find((c) => c.id === effectiveParentId)?.name

  return (
    <ResourceListPage
      title="Sub categories"
      description="The categories sitting under a parent. Same records as Categories, reached by their parent."
      noun="sub category"
      icon={FolderTree}
      emptyTitle={parentName ? `No sub categories under ${parentName}` : 'Choose a parent category'}
      emptyDescription={
        parentName
          ? 'Add one to break this category down further.'
          : 'Pick a parent above to see and manage the categories under it.'
      }
      searchPlaceholder="Search sub categories…"
      columns={columns}
      useList={useList}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={effectiveParentId ? () => setCreateOpen(true) : undefined}
      onEdit={(row) => setEditing(row)}
      remove={{
        mode: 'simple',
        remove: ({ id }) => deleteMutation.mutateAsync(id),
      }}
      toolbar={
        <div className="flex items-center gap-2">
          <Label htmlFor="parent-filter" className="text-xs text-muted-foreground">
            Under
          </Label>
          <Select
            value={effectiveParentId ?? ''}
            onValueChange={(value) => setParentId(value)}
          >
            <SelectTrigger id="parent-filter" className="h-8 w-56">
              <SelectValue placeholder="Choose a parent…" />
            </SelectTrigger>
            <SelectContent>
              {tree.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <CategoryCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        categoryTree={tree}
        defaultParentId={effectiveParentId ?? undefined}
      />
      <CategoryEditModal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        category={editing}
        categoryTree={tree}
      />
    </ResourceListPage>
  )
}
