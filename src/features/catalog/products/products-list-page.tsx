import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Package, Eye } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useProducts, useDeleteProduct, type ProductListRow, type ProductStatus } from '@/lib/api/products'
import { useCategoryTree } from '@/lib/api/categories'
import { useBrands } from '@/lib/api/brands'
import { CategoryFilter } from '@/features/catalog/products/category-filter'
import { formatCurrency } from '@/lib/utils/format'

const STOCK_VARIANT = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'destructive' } as const
const STOCK_LABEL = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' } as const

const STATUS_VARIANT = { DRAFT: 'secondary', ACTIVE: 'success', ARCHIVED: 'outline' } as const
const STATUS_LABEL = { DRAFT: 'Draft', ACTIVE: 'Active', ARCHIVED: 'Archived' } as const

export default function ProductsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [brandId, setBrandId] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  // Held here rather than inside the table so it can travel to the server —
  // the listing is paginated, so an in-table sort would only reorder this page.
  const [sorting, setSorting] = React.useState<SortingState>([])

  const sort = sorting[0]

  const { data, isLoading, isError, refetch } = useProducts({
    search,
    page,
    limit: pageSize,
    categoryId: categoryId ?? undefined,
    brandId: brandId === 'all' ? undefined : brandId,
    status: status === 'all' ? undefined : (status as ProductStatus),
    sortBy: sort?.id,
    sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : undefined,
  })
  const { data: categoryTree } = useCategoryTree()
  const { data: brandsData } = useBrands()
  const deleteMutation = useDeleteProduct()
  const confirmDialog = useConfirmDialog()

  const resetPage = () => setPage(1)

  const columns: ColumnDef<ProductListRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
        {/* fff */}
          <img
            src={row.original.images[0]?.url}
            alt=""
            className="size-8 shrink-0 rounded-md border border-border bg-muted object-cover"
          />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.sku ?? '—'}</span>
          </div>
        </div>
      ),
    },
    { id: 'brand', header: 'Brand', cell: ({ row }) => row.original.brand?.name ?? '—' },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => row.original.category?.name ?? '—',
    },
    { accessorKey: 'price', header: 'Price', cell: ({ row }) => formatCurrency(Number(row.original.price)) },
    {
      id: 'stock',
      header: 'Stock',
      cell: ({ row }) => <Badge variant={STOCK_VARIANT[row.original.stockStatus]}>{STOCK_LABEL[row.original.stockStatus]}</Badge>,
    },
    {
      id: 'viewCount',
      header: 'Views',
      // Sorted on the server, not in the table: these rows are one page of many,
      // so a client-side sort would answer "least viewed of these ten".
      enableSorting: true,
      // 0, never a dash: a product nobody has opened is a finding, not missing
      // data, and the two must not look alike.
      cell: ({ row }) => (row.original.viewCount ?? 0).toLocaleString('en-US'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => navigate(`/catalog/products/${row.original.id}`)}>
              <Eye /> View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/catalog/products/${row.original.id}/edit`)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    // The server archives rather than deletes when the product is
                    // referenced by orders; its message says which happened.
                    const { message } = await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Product deleted', description: message })
                  } catch (err) {
                    toast({ title: 'Could not delete product', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                  }
                })
              }
            >
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
        title="Products"
        description="Manage the products available in your store."
        actions={
          <Button size="sm" onClick={() => navigate('/catalog/products/new')}>
            <Plus /> New product
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        sorting={sorting}
        onSortingChange={(next) => {
          setSorting(next)
          // Page 3 of a name-ordered list is not page 3 of a view-ordered one.
          resetPage()
        }}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          resetPage()
        }}
        searchPlaceholder="Search by name or SKU…"
        onRowClick={(row) => navigate(`/catalog/products/${row.id}`)}
        emptyState={{ icon: Package, title: 'No products found', description: 'Try adjusting your filters or add a new product.' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <CategoryFilter
              tree={categoryTree ?? []}
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v)
                resetPage()
              }}
            />
            <Select
              value={brandId}
              onValueChange={(v) => {
                setBrandId(v)
                resetPage()
              }}
            >
              <SelectTrigger className="h-8 w-auto min-w-32 max-w-48">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brandsData?.data.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                resetPage()
              }}
            >
              <SelectTrigger className="h-8 w-auto min-w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          resetPage()
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this product?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
