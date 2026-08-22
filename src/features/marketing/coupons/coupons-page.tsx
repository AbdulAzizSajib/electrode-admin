import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/ui/data-table'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, type Coupon } from '@/lib/api/coupons'
import { formatDate } from '@/lib/utils/format'

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().min(0, 'Cannot be negative'),
  usageLimit: z.coerce.number().min(1, 'Must be at least 1'),
  minOrderAmount: z.coerce.number().min(0, 'Cannot be negative'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isActive: z.boolean(),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function CouponsPage() {
  const [search, setSearch] = React.useState('')
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Coupon | null>(null)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCoupons({ search })
  const createMutation = useCreateCoupon()
  const updateMutation = useUpdateCoupon()
  const deleteMutation = useDeleteCoupon()
  const confirmDialog = useConfirmDialog()

  const [defaultWindow] = React.useState(() => {
    const now = Date.now()
    return {
      startDate: new Date(now).toISOString().slice(0, 10),
      endDate: new Date(now + 30 * 86_400_000).toISOString().slice(0, 10),
    }
  })

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: {
      code: editing?.code ?? '',
      discountType: editing?.discountType ?? 'percentage',
      discountValue: editing?.discountValue ?? 10,
      usageLimit: editing?.usageLimit ?? 100,
      minOrderAmount: editing?.minOrderAmount ?? 0,
      startDate: editing?.startDate ?? defaultWindow.startDate,
      endDate: editing?.endDate ?? defaultWindow.endDate,
      isActive: editing?.isActive ?? true,
    },
  })

  const onSubmit = async (values: OutputValues) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: values })
        toast({ title: 'Coupon updated' })
      } else {
        await createMutation.mutateAsync(values)
        toast({ title: 'Coupon created' })
      }
      setSheetOpen(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const all = React.useMemo(() => data?.data ?? [], [data])
  const filteredPage = React.useMemo(() => all.slice((page - 1) * pageSize, page * pageSize), [all, page, pageSize])

  const columns: ColumnDef<Coupon>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono font-medium text-foreground">{row.original.code}</span> },
    { id: 'discount', header: 'Discount', cell: ({ row }) => (row.original.discountType === 'percentage' ? `${row.original.discountValue}%` : `$${row.original.discountValue.toFixed(2)}`) },
    { id: 'usage', header: 'Usage', cell: ({ row }) => `${row.original.usageCount} / ${row.original.usageLimit}` },
    { id: 'window', header: 'Valid', cell: ({ row }) => `${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}` },
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
                    toast({ title: 'Coupon deleted' })
                  } catch (err) {
                    toast({ title: 'Could not delete coupon', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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
        title="Coupons"
        description="Discount codes customers can apply at checkout."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
            <Plus /> New coupon
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
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by code…"
        emptyState={{ icon: Ticket, title: 'No coupons yet' }}
        page={page}
        pageSize={pageSize}
        total={all.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Edit coupon' : 'New coupon'}</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="discountType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="discountValue" render={({ field }) => (
                  <FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="usageLimit" render={({ field }) => (
                  <FormItem><FormLabel>Usage limit</FormLabel><FormControl><Input type="number" min="1" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="minOrderAmount" render={({ field }) => (
                  <FormItem><FormLabel>Min. order amount</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem><FormLabel>Start date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem><FormLabel>End date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create coupon'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this coupon?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
