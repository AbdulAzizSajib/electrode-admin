import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Tag, ListPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBrands, useDeleteBrand, type Brand } from '@/lib/api/brands'
import { formatDate, initials } from '@/lib/utils/format'

export const BRANDS_PATH = '/catalog/brands'

export default function BrandsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useBrands({ search, page, limit: pageSize })
  const deleteMutation = useDeleteBrand()
  const confirmDialog = useConfirmDialog()

  const columns: ColumnDef<Brand>[] = [
    {
      id: 'brand',
      header: 'Brand',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={row.original.logo ?? undefined} alt="" />
            <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'slug', header: 'Slug', cell: ({ row }) => <span className="text-muted-foreground">{row.original.slug}</span> },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="line-clamp-1 text-muted-foreground">{row.original.description}</span> },
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
            <DropdownMenuItem onClick={() => navigate(`${BRANDS_PATH}/${row.original.id}`)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Brand deleted' })
                  } catch (err) {
                    toast({ title: 'Could not delete brand', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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
        title="Brands"
        description="Manage the brands carried in your store."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`${BRANDS_PATH}/bulk`)}>
              <ListPlus /> Bulk add
            </Button>
            <Button size="sm" onClick={() => navigate(`${BRANDS_PATH}/new`)}>
              <Plus /> New brand
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Search brands…"
        emptyState={{ icon: Tag, title: 'No brands yet', description: 'Add your first brand to start tagging products.' }}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this brand?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
