import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Truck } from 'lucide-react'
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
import { useOrder, useUpdateOrderStatus, type OrderStatus } from '@/lib/api/orders'
import { usePaymentsByOrder, useRecordPayment, type PaymentMethod, type PaymentStatus } from '@/lib/api/payments'
import { useShipmentByOrder, useUpsertShipment, type ShipmentStatus } from '@/lib/api/shipments'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}
const STATUS_VARIANT: Record<OrderStatus, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  SHIPPED: 'default',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  COMPLETED: 'success',
}

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['COD', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER']
const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']
const SHIPMENT_STATUS_OPTIONS: ShipmentStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  method: z.enum(['COD', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER']),
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']),
})
type PaymentValues = z.input<typeof paymentSchema>
type PaymentOutput = z.output<typeof paymentSchema>

const shipmentSchema = z.object({
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
})
type ShipmentValues = z.infer<typeof shipmentSchema>

const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'COMPLETED']),
  note: z.string().optional(),
})
type StatusUpdateValues = z.infer<typeof statusUpdateSchema>

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(orderId)
  const { data: payments } = usePaymentsByOrder(orderId)
  const { data: shipment } = useShipmentByOrder(orderId)
  const updateStatus = useUpdateOrderStatus()
  const recordPayment = useRecordPayment()
  const upsertShipment = useUpsertShipment()
  const confirmCancel = useConfirmDialog()

  const [statusOpen, setStatusOpen] = React.useState(false)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [shipmentOpen, setShipmentOpen] = React.useState(false)

  useBreadcrumbLabel(order?.orderNumber)

  const statusForm = useForm<StatusUpdateValues>({
    resolver: zodResolver(statusUpdateSchema),
    values: { status: order?.status ?? 'PENDING', note: '' },
  })
  const paymentForm = useForm<PaymentValues, unknown, PaymentOutput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: 'CARD', status: 'PAID' },
  })
  const shipmentForm = useForm<ShipmentValues>({
    resolver: zodResolver(shipmentSchema),
    values: {
      carrier: shipment?.carrier ?? '',
      trackingNumber: shipment?.trackingNumber ?? '',
      status: shipment?.status ?? 'PENDING',
    },
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

  const paidTotal = (payments ?? []).filter((p) => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0)
  const balanceDue = Math.max(0, Number(order.totalAmount) - paidTotal)

  const submitStatus = async (values: StatusUpdateValues) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, input: values })
      toast({ title: `Order status updated to ${STATUS_LABEL[values.status]}` })
      setStatusOpen(false)
      statusForm.reset({ status: values.status, note: '' })
    } catch (err) {
      toast({ title: 'Could not update status', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const submitPayment = async (values: PaymentOutput) => {
    if (!orderId) return
    try {
      await recordPayment.mutateAsync({ orderId, input: values })
      toast({ title: 'Payment recorded' })
      setPaymentOpen(false)
      paymentForm.reset({ amount: 0, method: 'CARD', status: 'PAID' })
    } catch (err) {
      toast({ title: 'Could not record payment', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const submitShipment = async (values: ShipmentValues) => {
    if (!orderId) return
    try {
      await upsertShipment.mutateAsync({
        orderId,
        input: {
          carrier: values.carrier || undefined,
          trackingNumber: values.trackingNumber || undefined,
          status: values.status,
        },
        hasExisting: !!shipment,
      })
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
          description={`${order.customer.firstName} ${order.customer.lastName ?? ''}`}
          actions={
            <>
              <Badge variant={STATUS_VARIANT[order.status]} className="mr-1">{STATUS_LABEL[order.status]}</Badge>
              <Button size="sm" onClick={() => setStatusOpen(true)}>
                Update status
              </Button>
              {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    confirmCancel.confirm(async () => {
                      try {
                        await updateStatus.mutateAsync({ id: order.id, input: { status: 'CANCELLED' } })
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
                  {(order.items ?? []).map((item, i) => (
                    <TableRow key={`${item.productId}-${i}`}>
                      <TableCell className="font-medium text-foreground">
                        {item.productName}
                        <div className="text-xs font-normal text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(item.unitPrice))}</TableCell>
                      <TableCell>{formatCurrency(Number(item.totalPrice))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-sm">
              <Row label="Subtotal" value={formatCurrency(Number(order.subtotal))} />
              {Number(order.discountAmount) > 0 && <Row label="Discount" value={`-${formatCurrency(Number(order.discountAmount))}`} />}
              {/* The option's captured name, so this line reads as the choice
                  the shopper made rather than a bare "Shipping" — and keeps
                  reading that way after the option is renamed or deleted. */}
              <Row
                label={
                  order.deliveryOptionLabel ??
                  (order.deliveryMethod === 'PICKUP' ? 'Collection' : 'Shipping')
                }
                value={formatCurrency(Number(order.shippingAmount))}
              />
              <Row label="Tax" value={formatCurrency(Number(order.taxAmount))} />
              <Row label="Total" value={formatCurrency(Number(order.totalAmount))} bold />
            </div>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Payments</CardTitle>
              {balanceDue > 0 && order.status !== 'CANCELLED' && (
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
                    <span className="text-muted-foreground">{p.method.replace('_', ' ')} · {p.status} · {formatDateTime(p.createdAt)}</span>
                    <span className="font-medium text-foreground">{formatCurrency(Number(p.amount))}</span>
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
                  <Row label="Carrier" value={shipment.carrier ?? '—'} />
                  <Row label="Tracking #" value={shipment.trackingNumber ?? '—'} />
                  <Row label="Status" value={shipment.status.replace(/_/g, ' ')} />
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
              <span className="font-medium text-foreground">{order.customer.firstName} {order.customer.lastName ?? ''}</span>
              <span className="text-muted-foreground">{order.customer.email ?? '—'}</span>
            </CardContent>
          </Card>

          {/*
            Only for orders a campaign produced. Absent — not "—" — on a normal
            checkout order: a blank card on every order in the shop would be
            noise, and this one exists to answer "which ad brought this in".

            The captured title, not the relation, is what gets rendered: it
            survives the page being deleted or renamed, which is exactly when a
            merchant is looking back at what a finished campaign earned. The
            relation is used only to link to a page that still exists.
          */}
          {order.landingPageTitle && (
            <Card>
              <CardHeader><CardTitle>Campaign</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">{order.landingPageTitle}</span>
                {order.landingPage ? (
                  <Link
                    to={`/ui/landing-pages/${order.landingPage.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    /lp/{order.landingPage.slug}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">This landing page has been deleted.</span>
                )}
                {order.shippingAddress?.state && (
                  <span className="text-muted-foreground">
                    Delivery area: {order.shippingAddress.state}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/*
            A collection order must be unmistakable, because the failure it
            prevents is a real one: handing a parcel the customer is coming to
            fetch to a courier, and charging for a delivery nobody asked for.
            The address card below still renders whatever was captured, but this
            says plainly that nothing is being delivered.
          */}
          {order.deliveryMethod === 'PICKUP' && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader><CardTitle>Collection — do not dispatch</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">
                  {order.deliveryOptionLabel ?? 'Collection in person'}
                </span>
                <span className="text-muted-foreground">
                  The customer is collecting this order in person. It is not to be
                  handed to a courier.
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {order.deliveryMethod === 'PICKUP' ? 'Contact details' : 'Shipping address'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 text-sm text-foreground">
              {order.shippingAddress ? (
                <>
                  <span>{order.shippingAddress.fullName}</span>
                  <span>{order.shippingAddress.addressLine1}</span>
                  {order.shippingAddress.addressLine2 && <span>{order.shippingAddress.addressLine2}</span>}
                  <span>{order.shippingAddress.city}{order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} {order.shippingAddress.postalCode ?? ''}</span>
                  <span>{order.shippingAddress.country}</span>
                  <span className="text-muted-foreground">{order.shippingAddress.phone}</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {order.deliveryMethod === 'PICKUP'
                    ? // Expected, not missing data: the checkout stops asking a
                      // collecting shopper for an address, since there is
                      // nothing to deliver to.
                      'None — this order is being collected in person.'
                    : 'No shipping address on file.'}
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(order.statusHistory ?? []).map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{STATUS_LABEL[event.toStatus]}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                    {event.note && <span className="text-xs text-muted-foreground">{event.note}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update order status</DialogTitle></DialogHeader>
          <Form {...statusForm}>
            <form onSubmit={statusForm.handleSubmit(submitStatus)} className="flex flex-col gap-3.5">
              <FormField control={statusForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={statusForm.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
                <Button type="submit" loading={statusForm.formState.isSubmitting}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                      {PAYMENT_METHOD_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={paymentForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
              <FormField control={shipmentForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SHIPMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
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
