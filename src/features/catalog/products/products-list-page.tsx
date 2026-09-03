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
import { formatCurrency, formatDate, formatTime } from '@/lib/utils/format'

const STOCK_VARIANT = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'destructive' } as const
const STOCK_LABEL = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' } as const

/**
 * Splits the two prices a row shows.
 *
 * `compareAtPrice` is the struck-through "was" figure and `price` is what the
 * customer actually pays, so a product carrying both is on offer: the list
 * price is the higher one and the offer is the lower. A product with no
 * `compareAtPrice` is simply not on offer — its `price` IS the selling price,
 * and the offer column stays empty rather than repeating it.
 */
function prices(row: ProductListRow) {
  const onOffer = row.compareAtPrice !== null
  return {
    selling: Number(onOffer ? row.compareAtPrice : row.price),
    offered: onOffer ? Number(row.price) : null,
  }
}

/** An em dash, so an absent figure reads as "not recorded" rather than as zero. */
const EMPTY = <span className="text-muted-foreground">—</span>

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
          <img
            src={row.original.images[0]?.url}
            alt=""
            className="size-8 shrink-0 rounded-md border border-border bg-muted object-cover"
          />
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      // With a parent, the parent IS the category and the assigned record is
      // the sub-category below; without one, the assigned record is itself the
      // category. See `ProductListItem.category`.
      cell: ({ row }) => {
        const c = row.original.category
        if (!c) return EMPTY
        return c.parent?.name ?? c.name
      },
    },
    {
      id: 'subCategory',
      header: 'Sub category',
      cell: ({ row }) => {
        const c = row.original.category
        return c?.parent ? c.name : EMPTY
      },
    },
    { id: 'brand', header: 'Brand', cell: ({ row }) => row.original.brand?.name ?? EMPTY },
    { id: 'taxRule', header: 'Tax rule', cell: ({ row }) => row.original.taxRule?.name ?? EMPTY },
    {
      id: 'costPrice',
      header: 'Purchase',
      cell: ({ row }) =>
        row.original.costPrice === null ? EMPTY : formatCurrency(Number(row.original.costPrice)),
    },
    {
      id: 'sellingPrice',
      header: 'Selling',
      cell: ({ row }) => formatCurrency(prices(row.original).selling),
    },
    {
      id: 'offeredPrice',
      header: 'Offered',
      cell: ({ row }) => {
        const { offered } = prices(row.original)
        return offered === null ? EMPTY : (
          <span className="font-medium text-success">{formatCurrency(offered)}</span>
        )
      },
    },
    {
      id: 'stock',
      header: 'Stock',
      // The count is the answer; the badge is the alert on top of it, which is
      // what `lowStockThreshold` is fetched for.
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="tabular-nums">{row.original.stockQuantity}</span>
          {row.original.stockStatus !== 'in_stock' && (
            <Badge variant={STOCK_VARIANT[row.original.stockStatus]}>
              {STOCK_LABEL[row.original.stockStatus]}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'createdAt',
      header: 'Created',
      // Server-side, like every sort here: these rows are one page of many, so
      // an in-table sort would only reorder the ten on screen.
      enableSorting: true,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{formatDate(row.original.createdAt)}</span>
          <span className="text-xs text-muted-foreground">{formatTime(row.original.createdAt)}</span>
        </div>
      ),
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
