import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { useStock, useAdjustStock, type StockRow } from '@/lib/api/stock'
import { useWarehouses } from '@/lib/api/warehouses'

const schema = z.object({
  delta: z.coerce.number().refine((v) => v !== 0, 'Enter a non-zero amount'),
  reason: z.string().min(1, 'A reason is required'),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function StockPage() {
  const [search, setSearch] = React.useState('')
  const [warehouseId, setWarehouseId] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [adjusting, setAdjusting] = React.useState<StockRow | null>(null)

  const { data, isLoading, isError, refetch } = useStock({
    search,
    page,
    limit: pageSize,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
  })
  const { data: warehousesData } = useWarehouses()
  const adjustMutation = useAdjustStock()

  const form = useForm<Values, unknown, OutputValues>({ resolver: zodResolver(schema), defaultValues: { delta: 0, reason: '' } })

  const onSubmit = async (values: OutputValues) => {
    if (!adjusting) return
    try {
      await adjustMutation.mutateAsync({ id: adjusting.id, delta: values.delta, reason: values.reason })
      toast({ title: 'Stock adjusted' })
      setAdjusting(null)
      form.reset({ delta: 0, reason: '' })
    } catch (err) {
      toast({ title: 'Could not adjust stock', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const columns: ColumnDef<StockRow>[] = [
    { id: 'product', header: 'Product', cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{row.original.productName}</span>
        <span className="text-xs text-muted-foreground">{row.original.productSku}</span>
      </div>
    ) },
    { accessorKey: 'warehouseName', header: 'Warehouse' },
    { accessorKey: 'quantityOnHand', header: 'On hand' },
    { accessorKey: 'reserved', header: 'Reserved' },
    { accessorKey: 'available', header: 'Available', cell: ({ row }) => <span className="font-medium">{row.original.available}</span> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setAdjusting(row.original)}>
          <SlidersHorizontal /> Adjust
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Stock" description="Quantity on hand across your warehouses." />

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
        searchPlaceholder="Search by product…"
        emptyState={{ icon: Boxes, title: 'No stock records found' }}
        toolbar={
          <Select
            value={warehouseId}
            onValueChange={(v) => {
              setWarehouseId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehousesData?.data.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      <Dialog open={!!adjusting} onOpenChange={(open) => !open && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock — {adjusting?.productName}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField
                control={form.control}
                name="delta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity change (use negative to remove)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value === undefined ? '' : String(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. cycle count correction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjusting(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Save adjustment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
