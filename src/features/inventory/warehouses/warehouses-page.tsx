import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useWarehouses, useDeleteWarehouse, type Warehouse } from '@/lib/api/warehouses'

export const WAREHOUSES_PATH = '/inventory/warehouses'

export default function WarehousesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useWarehouses({ search })
  const deleteMutation = useDeleteWarehouse()
  const confirmDialog = useConfirmDialog()

  const all = React.useMemo(() => data?.data ?? [], [data])
  const filteredPage = React.useMemo(() => all.slice((page - 1) * pageSize, page * pageSize), [all, page, pageSize])

  const columns: ColumnDef<Warehouse>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'address', header: 'Address', cell: ({ row }) => <span className="text-muted-foreground">{row.original.address}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
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
            <DropdownMenuItem onClick={() => navigate(`${WAREHOUSES_PATH}/${row.original.id}`)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Warehouse deleted' })
                  } catch (err) {
                    toast({ title: 'Could not delete warehouse', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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
        title="Warehouses"
        description="Locations that hold and ship your inventory."
        actions={
          <Button size="sm" onClick={() => navigate(`${WAREHOUSES_PATH}/new`)}>
            <Plus /> New warehouse
          </Button>
        }
      />

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
        searchPlaceholder="Search warehouses…"
        emptyState={{ icon: WarehouseIcon, title: 'No warehouses yet' }}
        page={page}
        pageSize={pageSize}
        total={all.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this warehouse?"
        description="Warehouses with stock records cannot be deleted — deactivate instead."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
