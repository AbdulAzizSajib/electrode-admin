import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { useCreateRefund, useRefunds, type Refund, type RefundStatus } from '@/lib/api/refunds'
import { useOrders } from '@/lib/api/orders'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const STATUS_VARIANT: Record<RefundStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'destructive',
}

const schema = z.object({
  orderId: z.string().min(1, 'Select an order'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  reason: z.string().optional(),
})
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

export default function RefundsPage() {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [viewing, setViewing] = React.useState<Refund | null>(null)

  const { data, isLoading, isError, refetch } = useRefunds({ page, limit: pageSize })
  const { data: ordersData } = useOrders({ limit: 100 })
  const createMutation = useCreateRefund()

  const form = useForm<Values, unknown, OutputValues>({ resolver: zodResolver(schema), defaultValues: { orderId: '', amount: 0, reason: '' } })

  const onSubmit = async (values: OutputValues) => {
    try {
      await createMutation.mutateAsync({ orderId: values.orderId, input: { amount: values.amount, reason: values.reason } })
      toast({ title: 'Refund issued' })
      setCreateOpen(false)
      form.reset({ orderId: '', amount: 0, reason: '' })
    } catch (err) {
      toast({ title: 'Could not issue refund', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const columns: ColumnDef<Refund>[] = [
    { id: 'order', header: 'Order', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.order.orderNumber}</span> },
    { id: 'amount', header: 'Amount', cell: ({ row }) => formatCurrency(Number(row.original.amount)) },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-muted-foreground">{row.original.reason ?? '—'}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDate(row.original.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Refunds"
        description="Refunds issued against customer orders."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> New refund
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => setViewing(row)}
        emptyState={{ icon: Receipt, title: 'No refunds issued yet' }}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue a refund</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField control={form.control} name="orderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ordersData?.data.map((o) => <SelectItem key={o.id} value={o.id}>{o.orderNumber} — {formatCurrency(Number(o.totalAmount))}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>Issue refund</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund — {viewing?.order.orderNumber}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Order</span><span className="font-medium text-foreground">{viewing.order.orderNumber}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground">{formatCurrency(Number(viewing.amount))}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Reason</span><span>{viewing.reason ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><Badge variant={STATUS_VARIANT[viewing.status]}>{viewing.status}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Date</span><span>{formatDate(viewing.createdAt)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
