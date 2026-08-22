import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Ban, CheckCircle2, CreditCard, Truck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { FULFILLMENT_SEQUENCE, useCancelOrder, useOrder, useUpdateOrderStatus, type FulfillmentStatus } from '@/lib/api/orders'
import { usePaymentsByOrder, useRecordPayment, type PaymentMethod } from '@/lib/api/payments'
import { useShipmentByOrder, useUpsertShipment } from '@/lib/api/shipments'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<FulfillmentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
const STATUS_VARIANT: Record<FulfillmentStatus, 'secondary' | 'warning' | 'default' | 'success' | 'destructive'> = {
  pending: 'secondary',
  processing: 'warning',
  shipped: 'default',
  delivered: 'success',
  cancelled: 'destructive',
}

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  method: z.enum(['card', 'paypal', 'bank_transfer', 'cash_on_delivery']),
})
type PaymentValues = z.input<typeof paymentSchema>
type PaymentOutput = z.output<typeof paymentSchema>

const shipmentSchema = z.object({
  carrier: z.string().min(1, 'Carrier is required'),
  trackingNumber: z.string().min(1, 'Tracking number is required'),
})
type ShipmentValues = z.infer<typeof shipmentSchema>

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(orderId)
  const { data: payments } = usePaymentsByOrder(orderId)
  const { data: shipment } = useShipmentByOrder(orderId)
  const updateStatus = useUpdateOrderStatus()
  const cancelOrder = useCancelOrder()
  const recordPayment = useRecordPayment()
  const upsertShipment = useUpsertShipment()
  const confirmCancel = useConfirmDialog()

  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [shipmentOpen, setShipmentOpen] = React.useState(false)

  useBreadcrumbLabel(order?.orderNumber)

  const paymentForm = useForm<PaymentValues, unknown, PaymentOutput>({ resolver: zodResolver(paymentSchema), defaultValues: { amount: 0, method: 'card' } })
  const shipmentForm = useForm<ShipmentValues>({
    resolver: zodResolver(shipmentSchema),
    values: { carrier: shipment?.carrier ?? '', trackingNumber: shipment?.trackingNumber ?? '' },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!order) return <EmptyState title="Order not found" />

  const nextStatus = FULFILLMENT_SEQUENCE[FULFILLMENT_SEQUENCE.indexOf(order.fulfillmentStatus) + 1]
  const canAdvance = order.fulfillmentStatus !== 'cancelled' && !!nextStatus
  const canCancel = order.fulfillmentStatus === 'pending' || order.fulfillmentStatus === 'processing'
  const balanceDue = Math.max(0, order.total - (payments ?? []).filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0))

  const submitPayment = async (values: PaymentOutput) => {
    if (!orderId) return
    try {
      await recordPayment.mutateAsync({ orderId, amount: values.amount, method: values.method as PaymentMethod })
      toast({ title: 'Payment recorded' })
      setPaymentOpen(false)
      paymentForm.reset({ amount: 0, method: 'card' })
    } catch (err) {
      toast({ title: 'Could not record payment', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const submitShipment = async (values: ShipmentValues) => {
    if (!orderId) return
    try {
      await upsertShipment.mutateAsync({ orderId, ...values })
      toast({ title: shipment ? 'Shipment updated' : 'Shipment created' })
      setShipmentOpen(false)
    } catch (err) {
      toast({ title: 'Could not save shipment', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/sales/orders')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={order.orderNumber}
          description={order.customerName}
          actions={
            <>
              <Badge variant={STATUS_VARIANT[order.fulfillmentStatus]} className="mr-1">{STATUS_LABEL[order.fulfillmentStatus]}</Badge>
              {canAdvance && (
                <Button
                  size="sm"
                  onClick={() =>
                    updateStatus.mutate(
                      { id: order.id, status: nextStatus },
                      {
                        onSuccess: () => toast({ title: `Order marked ${STATUS_LABEL[nextStatus].toLowerCase()}` }),
                        onError: (err) => toast({ title: 'Could not update status', description: err.message, variant: 'destructive' }),
                      },
                    )
                  }
                  loading={updateStatus.isPending}
                >
                  <ArrowRight /> Mark {STATUS_LABEL[nextStatus].toLowerCase()}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    confirmCancel.confirm(async () => {
                      try {
                        await cancelOrder.mutateAsync(order.id)
                        toast({ title: 'Order cancelled' })
                      } catch (err) {
                        toast({ title: 'Could not cancel order', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                      }
                    })
                  }
                >
                  <Ban /> Cancel order
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium text-foreground">
                        {item.productName}
                        <div className="text-xs font-normal text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell>{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
              {order.discount > 0 && <Row label="Discount" value={`-${formatCurrency(order.discount)}`} />}
              <Row label="Shipping" value={formatCurrency(order.shippingCost)} />
              <Row label="Tax" value={formatCurrency(order.tax)} />
              <Row label="Total" value={formatCurrency(order.total)} bold />
            </div>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Payments</CardTitle>
              {balanceDue > 0 && order.fulfillmentStatus !== 'cancelled' && (
                <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                  <CreditCard /> Record payment
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!payments || payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet. Balance due: {formatCurrency(balanceDue)}</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.method.replace('_', ' ')} · {formatDateTime(p.createdAt)}</span>
                    <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Shipment</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShipmentOpen(true)}>
                <Truck /> {shipment ? 'Update shipment' : 'Create shipment'}
              </Button>
            </CardHeader>
            <CardContent>
              {shipment ? (
                <div className="flex flex-col gap-1 text-sm">
                  <Row label="Carrier" value={shipment.carrier} />
                  <Row label="Tracking #" value={shipment.trackingNumber} />
                  <Row label="Status" value={shipment.status.replace('_', ' ')} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shipment created yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{order.customerName}</span>
              <span className="text-muted-foreground">{order.customerEmail}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Shipping address</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-0.5 text-sm text-foreground">
              <span>{order.shippingAddress.fullName}</span>
              <span>{order.shippingAddress.line1}</span>
              {order.shippingAddress.line2 && <span>{order.shippingAddress.line2}</span>}
              <span>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</span>
              <span>{order.shippingAddress.country}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {order.statusHistory.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{STATUS_LABEL[event.status]}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(submitPayment)} className="flex flex-col gap-3.5">
              <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (balance due: {formatCurrency(balanceDue)})</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={paymentForm.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="cash_on_delivery">Cash on delivery</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                <Button type="submit" loading={paymentForm.formState.isSubmitting}>Record payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={shipmentOpen} onOpenChange={setShipmentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{shipment ? 'Update shipment' : 'Create shipment'}</DialogTitle></DialogHeader>
          <Form {...shipmentForm}>
            <form onSubmit={shipmentForm.handleSubmit(submitShipment)} className="flex flex-col gap-3.5">
              <FormField control={shipmentForm.control} name="carrier" render={({ field }) => (
                <FormItem><FormLabel>Carrier</FormLabel><FormControl><Input placeholder="e.g. UPS" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={shipmentForm.control} name="trackingNumber" render={({ field }) => (
                <FormItem><FormLabel>Tracking number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShipmentOpen(false)}>Cancel</Button>
                <Button type="submit" loading={shipmentForm.formState.isSubmitting}>{shipment ? 'Save changes' : 'Create shipment'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel.open}
        onOpenChange={confirmCancel.setOpen}
        title="Cancel this order?"
        description="The customer will be notified. This cannot be undone."
        confirmLabel="Cancel order"
        loading={confirmCancel.pending}
        onConfirm={confirmCancel.handleConfirm}
      />
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  )
}
