import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse, type Warehouse } from '@/lib/api/warehouses'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean(),
})
type Values = z.infer<typeof schema>

export default function WarehousesPage() {
  const [search, setSearch] = React.useState('')
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Warehouse | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useWarehouses({ search })
  const createMutation = useCreateWarehouse()
  const updateMutation = useUpdateWarehouse()
  const deleteMutation = useDeleteWarehouse()
  const confirmDialog = useConfirmDialog()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: editing?.name ?? '',
      code: editing?.code ?? '',
      address: editing?.address ?? '',
      city: editing?.city ?? '',
      country: editing?.country ?? '',
      isActive: editing?.isActive ?? true,
    },
  })

  const onSubmit = async (values: Values) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: values })
        toast({ title: 'Warehouse updated' })
      } else {
        await createMutation.mutateAsync(values)
        toast({ title: 'Warehouse created' })
      }
      setSheetOpen(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

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
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original)
                setSheetOpen(true)
              }}
            >
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
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setSheetOpen(true)
            }}
          >
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit warehouse' : 'New warehouse'}</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="Bangladesh" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-2">
                  <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create warehouse'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

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
