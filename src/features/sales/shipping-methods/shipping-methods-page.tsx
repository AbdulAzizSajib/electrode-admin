import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Truck } from 'lucide-react'
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
import {
  useCreateShippingMethod,
  useDeleteShippingMethod,
  useShippingMethods,
  useUpdateShippingMethod,
  type ShippingMethod,
} from '@/lib/api/shipping-methods'
import { formatCurrency } from '@/lib/utils/format'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  estimatedDays: z.coerce.number().int().positive().optional(),
  isActive: z.boolean(),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function ShippingMethodsPage() {
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ShippingMethod | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useShippingMethods()
  const createMutation = useCreateShippingMethod()
  const updateMutation = useUpdateShippingMethod()
  const deleteMutation = useDeleteShippingMethod()
  const confirmDialog = useConfirmDialog()

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      price: editing ? Number(editing.price) : 0,
      estimatedDays: editing?.estimatedDays ?? undefined,
      isActive: editing?.isActive ?? true,
    },
  })

  const onSubmit = async (values: OutputValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: values })
        toast({ title: 'Shipping method updated' })
      } else {
        await createMutation.mutateAsync(values)
        toast({ title: 'Shipping method created' })
      }
      setSheetOpen(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const all = React.useMemo(() => data?.data ?? [], [data])
  const filteredPage = React.useMemo(() => all.slice((page - 1) * pageSize, page * pageSize), [all, page, pageSize])

  const columns: ColumnDef<ShippingMethod>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <span className="text-muted-foreground">{row.original.description}</span> },
    { accessorKey: 'price', header: 'Price', cell: ({ row }) => (Number(row.original.price) === 0 ? 'Free' : formatCurrency(Number(row.original.price))) },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(row.original); setSheetOpen(true) }}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Shipping method deleted' })
                  } catch (err) {
                    toast({ title: 'Could not delete', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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
        title="Shipping Methods"
        description="Delivery options offered at checkout."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
            <Plus /> New shipping method
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filteredPage}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{ icon: Truck, title: 'No shipping methods yet' }}
        page={page}
        pageSize={pageSize}
        total={all.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Edit shipping method' : 'New shipping method'}</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="estimatedDays" render={({ field }) => (
                <FormItem><FormLabel>Estimated days (optional)</FormLabel><FormControl><Input type="number" min="1" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-2">
                  <FormLabel className="text-sm font-normal text-foreground">Active</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create shipping method'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this shipping method?"
        description="Shipping methods used by existing orders cannot be deleted — deactivate instead."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
