import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Printer, Truck } from 'lucide-react'
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
import { ORDER_STATUSES, useOrder, useUpdateOrderStatus, type OrderStatus } from '@/lib/api/orders'
import { usePaymentsByOrder, useRecordPayment, type PaymentMethod, type PaymentStatus } from '@/lib/api/payments'
import { useShipmentByOrder, useUpsertShipment, type ShipmentStatus } from '@/lib/api/shipments'
import {
  useConfiguredCourier,
  useCourierConfig,
  useCreateCourierReturn,
  useDispatchSingleOrder,
} from '@/lib/api/courier'
import { CourierStatusBadge } from '@/features/sales/courier/courier-status-badge'
import { courierNeedsAttention, courierStatusLabel } from '@/features/sales/courier/courier-presentation'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}
const STATUS_VARIANT: Record<OrderStatus, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'info',
  PROCESSING: 'warning',
  PACKED: 'info',
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

/**
 * The documents printable from an order, in fulfilment order: pick it, box it
 * with its invoice, label the parcel.
 *
 * Offered at every status rather than gated on one. A slip is reprinted when
 * the first is lost, and an invoice is reprinted for a customer who asks after
 * delivery — gating on PACKED would block both for no gain, since printing
 * mutates nothing.
 */
const PRINTABLE_DOCUMENTS = [
  { kind: 'packing-slip', label: 'Packing slip' },
  { kind: 'invoice', label: 'Invoice' },
  { kind: 'shipping-label', label: 'Label' },
] as const

/*
 * Derived from ORDER_STATUSES rather than re-listed, so adding a status to the
 * API module cannot leave this behind. A hand-written copy silently rejected
 * PACKED here while every other surface accepted it — which is a validation
 * error on a status the server supports, and reads as a bug in the server.
 *
 * This is shape only. Which transitions are legal comes from the order's own
 * `allowedTransitions`, computed server-side; see `nextStatusOptions` below.
 */
const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
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
  const dispatchOne = useDispatchSingleOrder()
  const createReturn = useCreateCourierReturn()

  /*
   * The courier this shop dispatches through, and what it can do. Every control
   * below reads from it rather than naming a courier outright: an operator
   * dispatching through one courier while the buttons name another cannot trust
   * anything else the panel says.
   */
  const { data: courierConfig } = useCourierConfig()
  const courier = useConfiguredCourier()
  const courierName = courier?.displayName ?? 'the courier'
  const confirmCancel = useConfirmDialog()

  const [statusOpen, setStatusOpen] = React.useState(false)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [shipmentOpen, setShipmentOpen] = React.useState(false)
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [returnReason, setReturnReason] = React.useState('')

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

  /*
   * What the backend will accept from here. `CANCELLED` and `COMPLETED` are
   * terminal, and a delivered order cannot be cancelled — goods already with
   * the customer come back through a return, not a cancellation that would
   * credit stock nobody has.
   */
  const allowedStatuses = order.allowedTransitions ?? []

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

  /**
   * The one condition the whole courier surface reads from.
   *
   * Derived from the loaded shipment rather than threaded through as a separate
   * flag, so it cannot disagree with what the backend will accept — the server
   * refuses manual writes on exactly this condition.
   */
  const isCourierOwned = Boolean(shipment?.consignmentId)

  /*
   * The courier carrying THIS parcel, which is not necessarily the one the shop
   * dispatches through now. A merchant who switched couriers still has parcels
   * out with the old one, and showing them the new courier's name against an old
   * consignment would be a plain lie about who has the box.
   *
   * Falls back to the configured provider only for a shipment with no recorded
   * provider — which cannot occur under the current schema default, but keeps
   * the display honest rather than blank if it ever does.
   */
  const shipmentCourier = courierConfig?.providers.find(
    (provider) => provider.id === shipment?.courierProvider,
  )
  const shipmentCourierName =
    shipmentCourier?.displayName ?? shipment?.carrier ?? courierName

  const dispatchSingle = async () => {
    try {
      const summary = await dispatchOne.mutateAsync(order!.id)
      const result = summary.results[0]

      if (result?.outcome === 'dispatched') {
        toast({ title: `Sent to ${courierName} — consignment ${result.consignmentId}` })
        return
      }

      // Anything else is reported with the server's own words. An unconfirmed
      // outcome especially must not read as a plain failure: retrying it is how
      // one parcel becomes two consignments.
      toast({
        title:
          result?.outcome === 'unconfirmed'
            ? `Outcome unknown — check ${courierName} before sending again`
            : 'Not sent to the courier',
        description: result?.detail,
        variant: result?.outcome === 'unconfirmed' ? 'default' : 'destructive',
      })
    } catch (err) {
      toast({
        title: 'Could not send to the courier',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const submitReturn = async () => {
    try {
      await createReturn.mutateAsync({
        orderId: order!.id,
        reason: returnReason.trim() || undefined,
      })
      toast({ title: 'Return request raised with the courier' })
      setReturnOpen(false)
      setReturnReason('')
    } catch (err) {
      toast({
        title: 'The courier did not accept the return',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
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
              {/* Print targets open in a new tab so the order stays put behind
                  them — a packer prints a slip, prints a label, and is still on
                  the order when they come back. Each route renders outside the
                  app shell so the printed page carries no chrome. */}
              {PRINTABLE_DOCUMENTS.map((doc) => (
                <Button key={doc.kind} variant="outline" size="lg" asChild>
                  <Link to={`/sales/orders/${order.id}/print/${doc.kind}`} target="_blank" rel="noreferrer">
                    <Printer /> {doc.label}
                  </Link>
                </Button>
              ))}
              {/* Hidden at a terminal status: there is nothing to set, and
                  offering the control invites the operator to try. */}
              {allowedStatuses.length > 0 && (
                <Button size="sm" onClick={() => setStatusOpen(true)}>
                  Update status
                </Button>
              )}
              {allowedStatuses.includes('CANCELLED') && (
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
              {/* Still reachable when the courier owns the shipment: the dialog
                  is where the fields are shown disabled and Steadfast is named
                  as their source. Hiding it would leave the operator with no
                  explanation of why they cannot edit. */}
              <Button size="sm" variant="outline" onClick={() => setShipmentOpen(true)}>
                <Truck />{' '}
                {isCourierOwned ? 'View shipment' : shipment ? 'Update shipment' : 'Create shipment'}
              </Button>
            </CardHeader>
            <CardContent>
              {shipment ? (
                <div className="flex flex-col gap-1 text-sm">
                  <Row label="Carrier" value={shipment.carrier ?? '—'} />
                  <Row label="Tracking #" value={shipment.trackingNumber ?? '—'} />
                  <Row label="Status" value={shipment.status.replace(/_/g, ' ')} />
                  {isCourierOwned && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Managed by Steadfast — these values come from the courier and
                      are not edited here.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No shipment created yet.</p>
              )}
            </CardContent>
          </Card>

          {/*
           * Courier state, kept separate from the shipment card above: one is
           * what this shop recorded, the other is what the courier reports, and
           * merging them would hide which is which.
           */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Courier</CardTitle>
              <div className="flex gap-2">
                {/* Offered only for an order the server would actually accept.
                    Anything else states the reason instead of presenting a
                    control that will be refused. */}
                {!isCourierOwned && order.status === 'PACKED' && courier?.capabilities.dispatch && (
                  <Button
                    size="sm"
                    disabled={dispatchOne.isPending}
                    onClick={() => void dispatchSingle()}
                  >
                    <Truck /> {dispatchOne.isPending ? 'Sending…' : `Send to ${courierName}`}
                  </Button>
                )}
                {/* Hidden where the creating courier has no return API — a
                    control that exists only to be refused teaches the operator
                    the panel is unreliable. The server refuses it too. */}
                {isCourierOwned && shipmentCourier?.capabilities.returns && (
                  <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
                    Raise return
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isCourierOwned ? (
                <div className="flex flex-col gap-1 text-sm">
                  <Row label="Courier" value={shipmentCourierName} />
                  <Row label="Consignment" value={shipment?.consignmentId ?? '—'} />
                  <Row label="Tracking code" value={shipment?.trackingNumber ?? '—'} />
                  <Row label="Invoice sent" value={shipment?.courierInvoice ?? '—'} />
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-muted-foreground">Courier status</span>
                    <CourierStatusBadge status={shipment?.courierStatus} />
                  </div>
                  <Row
                    label="Last synced"
                    value={
                      shipment?.courierSyncedAt
                        ? formatDateTime(shipment.courierSyncedAt)
                        : 'Never'
                    }
                  />
                  {courierNeedsAttention(shipment?.courierStatus) && (
                    <p className="mt-2 rounded-md border border-warning/40 bg-warning/5 px-2 py-1.5 text-xs text-foreground">
                      The courier reports this consignment as{' '}
                      {courierStatusLabel(shipment?.courierStatus).toLowerCase()}. Stock and
                      the order status are deliberately unchanged — the parcel may still be
                      in transit back. Resolve it with the order's own cancel or return
                      flow once it is physically in hand.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {!courier?.capabilities.dispatch
                    ? `This shop is set to ${courierName}, which has no dispatch integration. Hand the parcel over and record the shipment above.`
                    : order.status === 'PACKED'
                      ? 'Not dispatched yet.'
                      : `Not dispatched. Only a packed order can be sent to the courier — this one is ${STATUS_LABEL[order.status].toLowerCase()}.`}
                </p>
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
                    {/* Only the transitions legal from here. Offering the full
                        list let an order be moved from CANCELLED to DELIVERED,
                        and cancelling now returns stock to the shelf — a
                        transition that cannot happen physically produces side
                        effects nothing can reconcile. */}
                    <SelectContent>
                      {allowedStatuses.map((value) => (
                        <SelectItem key={value} value={value}>{STATUS_LABEL[value]}</SelectItem>
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
          {/*
           * Disabled rather than hidden when the courier owns this shipment.
           * A hidden tracking number reads as "this order has none"; a disabled
           * one with the courier named beside it says what is actually true.
           * The backend refuses these writes on the same condition, so the form
           * cannot offer a control the server will reject.
           * See design.md Decision 6.
           */}
          {isCourierOwned && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This shipment is managed by Steadfast (consignment {shipment?.consignmentId}).
              Its carrier, tracking number, status and timestamps come from the courier and
              cannot be edited here.
            </p>
          )}
          <Form {...shipmentForm}>
            <form onSubmit={shipmentForm.handleSubmit(submitShipment)} className="flex flex-col gap-3.5">
              <FormField control={shipmentForm.control} name="carrier" render={({ field }) => (
                <FormItem><FormLabel>Carrier</FormLabel><FormControl><Input placeholder="e.g. UPS" disabled={isCourierOwned} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={shipmentForm.control} name="trackingNumber" render={({ field }) => (
                <FormItem><FormLabel>Tracking number</FormLabel><FormControl><Input disabled={isCourierOwned} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={shipmentForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isCourierOwned}>
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
                <Button type="submit" disabled={isCourierOwned} loading={shipmentForm.formState.isSubmitting}>{shipment ? 'Save changes' : 'Create shipment'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Courier return. Reachable only from the Courier card, which renders it
          only for a dispatched order — the server refuses one without a
          consignment, so offering it otherwise would teach the operator that
          the button does not work. */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a return with Steadfast</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3.5">
            <p className="text-sm text-muted-foreground">
              This asks the courier to return consignment {shipment?.consignmentId}. It does
              not cancel the order, refund anything, or return stock.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="courier-return-reason" className="text-sm font-medium">
                Reason <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="courier-return-reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Customer refused delivery"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={createReturn.isPending}
              onClick={() => void submitReturn()}
            >
              Raise return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel.open}
        onOpenChange={confirmCancel.setOpen}
        title="Cancel this order?"
        // Says what happens to stock: the items go back on the shelf and become
        // sellable again, which is the part an operator needs to predict.
        description="The items go back into stock and the customer will be notified. This cannot be undone."
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
