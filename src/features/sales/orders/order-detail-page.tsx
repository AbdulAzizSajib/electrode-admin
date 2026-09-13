import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Ban, CheckCircle2, CreditCard, PackageCheck, Printer, Truck } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils/cn'

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
/**
 * The colour carried by each status, as a dot beside its label.
 *
 * This replaces a `<Badge variant>` map that coloured a read-only badge in the
 * header. The badge went when the status became editable in place — the select
 * trigger shows the current status already, and two things saying it side by
 * side is one of them going stale. The colour was worth keeping though: it is
 * what makes the status readable at a glance across a shift, so it moves onto
 * the trigger rather than being dropped with the badge.
 *
 * Deliberately a background colour, not a text colour: the label beside it
 * keeps the foreground contrast, so the hue is never the only thing carrying
 * the meaning.
 */
const STATUS_DOT: Record<OrderStatus, string> = {
  PENDING: 'bg-muted-foreground',
  CONFIRMED: 'bg-info',
  PROCESSING: 'bg-warning',
  PACKED: 'bg-info',
  SHIPPED: 'bg-foreground',
  DELIVERED: 'bg-success',
  CANCELLED: 'bg-destructive',
  COMPLETED: 'bg-success',
}

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['COD', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER']
const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']

/**
 * Payment statuses in the panel's own voice.
 *
 * The wire values are shouted enum constants, and rendering them raw put
 * `PARTIALLY_REFUNDED` in a sentence beside a human date. Every other status on
 * this page is sentence case (`STATUS_LABEL`, the shipment statuses); payments
 * were the one surface still reading as a database dump.
 */
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
}
const SHIPMENT_STATUS_OPTIONS: ShipmentStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']

/**
 * Shipment statuses in sentence case, for the same reason as
 * `PAYMENT_STATUS_LABEL`.
 *
 * This replaces a `.replace(/_/g, ' ')` that ran at three call sites and left
 * `OUT FOR DELIVERY` shouting in the middle of ordinary prose. A map also means
 * a status can be worded rather than merely de-underscored.
 */
const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  RETURNED: 'Returned',
}

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
 * There is no local schema for the status change, and deliberately so.
 *
 * There was one — a zod enum over ORDER_STATUSES with an optional note, for the
 * dialog this control replaced. With the status set directly from a select
 * whose options come from the order's own server-computed
 * `allowedTransitions`, there is no free-form input left to validate: the only
 * values reachable are ones the server has already said it will accept.
 *
 * If a field is ever added back here, derive its status enum from
 * `ORDER_STATUSES` rather than re-listing the statuses. A hand-written copy
 * once silently rejected PACKED while every other surface accepted it, which
 * reads as a bug in the server.
 */

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

  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [shipmentOpen, setShipmentOpen] = React.useState(false)
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [returnReason, setReturnReason] = React.useState('')

  useBreadcrumbLabel(order?.orderNumber)

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
   * What the backend will accept from here: every status except the one the
   * order is already at. The server used to return a forward-only subset, and
   * this list is still read from it rather than assumed — the restriction was
   * lifted on the merchant's instruction so a mis-clicked status could be
   * walked back, and reinstating it is a server-side edit that this page must
   * follow rather than duplicate.
   */
  const allowedStatuses = order.allowedTransitions ?? []

  /**
   * Writes a status, from either of the two controls that set one — the header
   * select for routine changes, the Cancel order button for the one that is
   * not. Shared so the toast, the error handling and the mutation cannot drift
   * between them.
   *
   * A failure needs no local state to recover from: the select is driven by
   * `order.status` rather than its own state, so a refused change leaves the
   * query's value in place and the trigger stays on where the order actually
   * is, with the server's reason in the toast.
   */
  const runStatusUpdate = async (next: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, input: { status: next } })
      toast({ title: `Order status updated to ${STATUS_LABEL[next]}` })
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

  /*
   * Whether the dispatch button is offered for this order right now — the exact
   * condition the server accepts, named once.
   *
   * Read by the Courier card that renders the button and by the Shipment card
   * above it, which uses it to say who is about to fill that card in. Written
   * out twice, the two would eventually disagree and the page would advise
   * against a button it was simultaneously showing.
   */
  const canDispatchHere =
    !isCourierOwned && order.status === 'PACKED' && Boolean(courier?.capabilities.dispatch)

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
              {/* Print targets open in a new tab so the order stays put behind
                  them — a packer prints a slip, prints a label, and is still on
                  the order when they come back. Each route renders outside the
                  app shell so the printed page carries no chrome.

                  Grouped into one segmented control and given a single icon.
                  Three separate outline buttons, each repeating a printer
                  glyph, read as three unrelated decisions at the same weight as
                  setting the status — when they are one decision (which
                  document?) taken far less often. The seams are the group's own
                  dividers, so the set reads as one object. */}
              <div className="flex shrink-0 items-center divide-x divide-border overflow-hidden rounded-md border border-input">
                {/* Self-stretching rather than relying on the row's baseline:
                    the icon is the only child that is not an h-9 button, and a
                    bare inline span would sit optically high against them. */}
                <span className="flex h-9 shrink-0 items-center pl-3 pr-1.5 text-muted-foreground">
                  <Printer className="size-4" />
                </span>
                {PRINTABLE_DOCUMENTS.map((doc) => (
                  <Button
                    key={doc.kind}
                    variant="ghost"
                    size="lg"
                    className="rounded-none border-0"
                    asChild
                  >
                    <Link to={`/sales/orders/${order.id}/print/${doc.kind}`} target="_blank" rel="noreferrer">
                      {doc.label}
                    </Link>
                  </Button>
                ))}
              </div>
              {/*
                The status is edited in place rather than through a dialog. It
                was an "Update status" button opening a modal with a status
                select, an optional note and a Save — three interactions and a
                context switch to set one field, on the control an operator
                touches more than any other on this page. The note went with the
                dialog: it was optional, almost always left blank, and not worth
                a modal on its own. `OrderStatusHistory.note` still accepts one,
                so a future control can fill it without a schema change.

                Picking a status saves immediately. There is no second field to
                fill in and nothing to review, so a confirm step would only be a
                second click on a decision already made — and every status
                reachable from here is one the next pick can undo, since the
                server stopped restricting transitions. CANCELLED is the
                exception and is not in this list; see below.

                The trigger doubles as the current-status display — it shows the
                order's status when idle, so the badge that used to sit here
                would now be repeating it.
              */}
              {allowedStatuses.length > 0 && (
                <Select
                  value={order.status}
                  onValueChange={(next) => void runStatusUpdate(next as OrderStatus)}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="h-9 w-44" aria-label="Order status">
                    <SelectValue />
                  </SelectTrigger>
                  {/* Matched to the trigger rather than sized to its longest
                      label, so the panel opens as a continuation of the box it
                      came from instead of a narrower one floating under it.
                      `min-w` on the primitive would otherwise let it shrink to
                      the content. */}
                  <SelectContent className="w-(--radix-select-trigger-width)">
                    {/*
                     * Statuses in one fixed order, whatever the order currently is.
                     *
                     * The current status used to be prepended as the first item,
                     * so moving an order reshuffled the whole list: the moment it
                     * became CONFIRMED, "Confirmed" jumped to the top and every
                     * status below it slid out from under the operator's cursor.
                     * `ORDER_STATUSES` keeps the sequence constant — Pending →
                     * Confirmed → Processing → … — while the current status still
                     * appears in its own slot, marked and non-selectable: the
                     * server rejects a no-op, and offering it would produce an
                     * error toast for a click that means "leave it alone".
                     *
                     * CANCELLED is skipped when it is only an option — it keeps
                     * its own button beside this, where a destructive action is
                     * visible as one rather than sitting a click deep in the
                     * list. When the order IS cancelled it must still appear,
                     * as the marked current status above.
                     */}
                    {ORDER_STATUSES.filter(
                      (value) =>
                        value === order.status ||
                        (allowedStatuses.includes(value) && value !== 'CANCELLED'),
                    ).map((value) => (
                      <SelectItem key={value} value={value} disabled={value === order.status}>
                        <StatusOption status={value} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Outline, not solid destructive. A filled red button sitting
                  permanently in the header is the loudest thing on a page whose
                  routine action is the status select beside it — it draws the
                  eye to the one control an operator almost never wants. The
                  destructive intent is carried by colour and confirmed in a
                  dialog; it does not also need the heaviest fill on screen. */}
              {allowedStatuses.includes('CANCELLED') && (
                <Button
                  variant="outline"
                  size="lg"
                  className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                  disabled={updateStatus.isPending}
                  onClick={() => confirmCancel.confirm(() => runStatusUpdate('CANCELLED'))}
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
                    {/* Quantities and money are read down the column, not across
                        the row: an operator checking a picked box against the
                        order compares digits in the same place. Right-aligned
                        so the units line up whatever the magnitude. */}
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items ?? []).map((item, i) => (
                    <TableRow key={`${item.productId}-${i}`}>
                      <TableCell className="font-medium text-foreground">
                        {item.productName}
                        <div className="text-xs font-normal text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      {/* `tabular-nums` throughout: the default proportional
                          figures give `1` a narrower advance than `0`, so
                          ৳1,050.00 and ৳120.00 do not align on the decimal even
                          when the cell is right-aligned. */}
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unitPrice))}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">{formatCurrency(Number(item.totalPrice))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {/*
              The money summary. Constrained and pushed right so the labels sit
              beside their figures rather than at opposite ends of a full-width
              card — a "Tax" three hundred pixels from its amount is two facts,
              not one line.
            */}
            <div className="flex justify-end border-t border-border px-4 py-3 text-sm">
              <div className="flex w-full max-w-xs flex-col gap-1">
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
                {/* Ruled off and stepped up a size: the total is the figure the
                    other four exist to explain, and weight alone did not carry
                    that when every line shared one type size. */}
                <Row
                  label="Total"
                  value={formatCurrency(Number(order.totalAmount))}
                  bold
                  className="mt-1 border-t border-border pt-2 text-base"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Payments</CardTitle>
              {balanceDue > 0 && order.status !== 'CANCELLED' && (
                <Button size="lg" variant="outline" onClick={() => setPaymentOpen(true)}>
                  <CreditCard /> Record payment
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!payments || payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {p.method.replace('_', ' ')} · {PAYMENT_STATUS_LABEL[p.status] ?? p.status} · {formatDateTime(p.createdAt)}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">{formatCurrency(Number(p.amount))}</span>
                  </div>
                ))
              )}

              {/*
                What is still owed, stated on every unsettled order rather than
                only on one with no payments at all.

                It used to be a tail on the empty-state sentence, which meant a
                COD order carrying a PENDING payment showed the payment and the
                total and left the operator to subtract: the row reads
                "COD · Pending · ৳1,170.00" beside a ৳1,170.00 total, and
                nothing on the card says the money has not arrived. On a
                cash-on-delivery shop that is the question the card exists to
                answer, so it is a line of its own — ruled off, in the warning
                hue, and never silently absent.

                Settled orders say so instead of showing ৳0.00 due: zero is a
                figure to read and check, "Paid in full" is not.
              */}
              {order.status !== 'CANCELLED' && (
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2 text-sm">
                  <span className="shrink-0 text-muted-foreground">Balance due</span>
                  {balanceDue > 0 ? (
                    <span className="shrink-0 font-semibold tabular-nums text-warning">
                      {formatCurrency(balanceDue)}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 font-medium text-success">
                      <CheckCircle2 className="size-3.5" /> Paid in full
                    </span>
                  )}
                </div>
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
              <Button size="lg" variant="outline" onClick={() => setShipmentOpen(true)}>
                <Truck />{' '}
                {isCourierOwned ? 'View shipment' : shipment ? 'Update shipment' : 'Create shipment'}
              </Button>
            </CardHeader>
            <CardContent>
              {shipment ? (
                <div className="flex flex-col gap-1 text-sm">
                  <Row label="Carrier" value={shipment.carrier ?? '—'} />
                  {/* Tracking belongs to the Courier card when the courier owns
                      the shipment, so it is not repeated here: both rows read
                      the same string, and one copy next to its consignment id
                      is enough. */}
                  {!isCourierOwned && <Row label="Tracking #" value={shipment.trackingNumber ?? '—'} />}
                  <Row label="Status" value={SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status} />
                  {isCourierOwned && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Managed by {shipmentCourierName} — these values come from the courier
                      and are not edited here.
                    </p>
                  )}
                </div>
              ) : (
                /*
                 * The empty state says who fills this in, not just that it is
                 * empty.
                 *
                 * "No shipment created yet." beside a "Create shipment" button
                 * reads as an instruction, and on a shop that dispatches through
                 * an integrated courier it is the wrong one: dispatching writes
                 * this card itself, and a shipment entered by hand first is
                 * overwritten by the consignment. An operator who follows the
                 * button does harmless but wasted work and reasonably concludes
                 * the panel is confusing. So the sentence names the courier that
                 * is about to do it.
                 */
                <p className="text-sm text-muted-foreground">
                  {canDispatchHere
                    ? `No shipment yet. Sending this order to ${courierName} fills this in automatically — you only need to enter one by hand if you are shipping it yourself.`
                    : 'No shipment created yet.'}
                </p>
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
                {canDispatchHere && (
                  <Button
                    size="lg"
                    loading={dispatchOne.isPending}
                    onClick={() => void dispatchSingle()}
                  >
                    {!dispatchOne.isPending && <Truck />}
                    {dispatchOne.isPending ? 'Sending…' : `Send to ${courierName}`}
                  </Button>
                )}
                {/* Hidden where the creating courier has no return API — a
                    control that exists only to be refused teaches the operator
                    the panel is unreliable. The server refuses it too. */}
                {isCourierOwned && shipmentCourier?.capabilities.returns && (
                  <Button size="lg" variant="outline" onClick={() => setReturnOpen(true)}>
                    Raise return
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isCourierOwned ? (
                <div className="flex flex-col gap-1 text-sm">
                  <Row label="Courier" value={shipmentCourierName} />
                  {/* Identifiers, monospaced — these are the three values an
                      operator reads aloud on the phone or pastes into the
                      courier's own portal, and a proportional face makes a
                      transposed digit invisible. Monospace for data, which is
                      what it is for. */}
                  <Row label="Consignment" value={shipment?.consignmentId ?? '—'} mono />
                  <Row label="Tracking code" value={shipment?.trackingNumber ?? '—'} mono />
                  <Row label="Invoice sent" value={shipment?.courierInvoice ?? '—'} mono />
                  <div className="flex items-baseline justify-between gap-4 py-0.5">
                    <span className="shrink-0 text-muted-foreground">Courier status</span>
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
              {/*
                An address, not a dash. A guest checkout genuinely has no email
                on the customer record, and "—" makes that look like data the
                panel failed to load — the operator's next move is to go
                looking for it. Saying "No email on file" ends the question,
                and a real address becomes a mailto so contacting the customer
                does not mean retyping it.
              */}
              {order.customer.email ? (
                <a
                  href={`mailto:${order.customer.email}`}
                  className="w-fit break-all text-primary underline-offset-4 hover:underline"
                >
                  {order.customer.email}
                </a>
              ) : (
                <span className="text-muted-foreground">No email on file</span>
              )}
              {/* The phone sits here only when there is no address below —
                  checkout's contact phone lives in the address block, and
                  showing it twice is noise. A collecting shopper has no
                  address, so the phone moves up beside the name. */}
              {!order.shippingAddress && order.customer.phone && (
                <span className="text-muted-foreground">{order.customer.phone}</span>
              )}
              {/*
                The address, one block under the same card rather than a second
                card that restated the shopper's name. The parcel's recipient
                keeps its own line — it can differ from the account holder, so
                the two are not one fact to dedupe.
              */}
              {order.shippingAddress ? (
                <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-2 text-foreground">
                  <span>{order.shippingAddress.fullName}</span>
                  <span>{order.shippingAddress.addressLine1}</span>
                  {order.shippingAddress.addressLine2 && <span>{order.shippingAddress.addressLine2}</span>}
                  <span>{order.shippingAddress.city}{order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''} {order.shippingAddress.postalCode ?? ''}</span>
                  <span>{order.shippingAddress.country}</span>
                  <span className="text-muted-foreground">{order.shippingAddress.phone}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {order.deliveryMethod === 'PICKUP'
                    ? // The Collection card already says who is collecting and
                      // why; this line only needs to say no address is on file.
                      'No delivery address.'
                    : 'No shipping address on file.'}
                </span>
              )}
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
            The Customer card above stays short ("No delivery address.") —
            this card is where that, plainly, is stated.
          */}
          {/* Warning tokens, not raw amber-*. The palette defines --color-warning
              and --color-warning-bg for exactly this, and the hardcoded pair
              also carried a dark: variant on a panel that ships light only. */}
          {order.deliveryMethod === 'PICKUP' && (
            <Card className="border-warning/40 bg-warning-bg">
              <CardHeader className="border-warning/25">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <PackageCheck className="size-4 shrink-0" />
                  Collection — do not dispatch
                </CardTitle>
              </CardHeader>
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
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent>
              {(order.statusHistory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
              ) : (
                /*
                 * A timeline, not a list of ticks.
                 *
                 * Every entry used to carry the same green CheckCircle2 — so a
                 * cancellation and a delivery were drawn identically, and the
                 * one status that means the order stopped read as another
                 * success. The dot now carries the status's own colour, from
                 * the same STATUS_DOT map the header select uses, so a status
                 * looks the same wherever this page shows it.
                 *
                 * The newest entry sits at the top (the API's own order) and is
                 * the only one at full strength; the rest recede. An operator
                 * opening this card is asking "where is it now", and answering
                 * that took scanning to the end of an evenly-weighted list.
                 */
                <ol className="flex flex-col">
                  {(order.statusHistory ?? []).map((event, i, all) => {
                    const isCurrent = i === 0
                    const isLast = i === all.length - 1

                    return (
                      <li key={i} className="flex gap-3 text-sm">
                        {/* The rail: dot plus the line down to the next entry.
                            The line is omitted on the last row rather than
                            drawn and hidden, so nothing dangles past the final
                            dot. */}
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              'mt-1 size-2 shrink-0 rounded-full',
                              STATUS_DOT[event.toStatus],
                              !isCurrent && 'opacity-60',
                            )}
                          />
                          {!isLast && <span className="w-px flex-1 bg-border" />}
                        </div>
                        <div className={cn('flex flex-col', !isLast && 'pb-3')}>
                          <span
                            className={cn(
                              'font-medium',
                              isCurrent ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {STATUS_LABEL[event.toStatus]}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatDateTime(event.createdAt)}
                          </span>
                          {event.note && <span className="text-xs text-muted-foreground">{event.note}</span>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
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
                      {PAYMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</SelectItem>)}
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
          {/* Names the courier that actually created this consignment, not a
              hardcoded one. A parcel dispatched before the shop switched
              couriers is still carried by the old one, and telling the operator
              otherwise is the same lie the Courier card is careful not to
              tell. */}
          {isCourierOwned && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This shipment is managed by {shipmentCourierName} (consignment{' '}
              {shipment?.consignmentId}). Its carrier, tracking number, status and
              timestamps come from the courier and cannot be edited here.
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
                      {SHIPMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{SHIPMENT_STATUS_LABEL[s]}</SelectItem>)}
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
            <DialogTitle>Raise a return with {shipmentCourierName}</DialogTitle>
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

/**
 * A status as it appears in the header select — its colour, then its name.
 *
 * Used for the options AND for the current value, because Radix renders the
 * selected item's children into the trigger: writing the trigger separately
 * would let the two drift, which on this control means the dot beside a status
 * disagreeing with the dot beside that same status one row down.
 */
function StatusOption({ status }: { status: OrderStatus }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * A label and its value on one line, the page's unit of read-only detail.
 *
 * `gap-4` rather than pure `justify-between`: a long value (a courier's
 * consignment id, a tracking code) would otherwise run up against its label
 * with nothing between them. The value is allowed to wrap and stays
 * right-aligned when it does, so a two-line value still reads as one field.
 *
 * Values carry `tabular-nums` unconditionally. Most are money, ids or
 * timestamps — all figures meant to be compared down a column — and the ones
 * that are not contain no digits for it to affect.
 */
function Row({
  label,
  value,
  bold,
  mono,
  className,
}: {
  label: string
  value: string
  bold?: boolean
  /** For identifiers that get read aloud or pasted — see the Courier card. */
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-right tabular-nums',
          mono && 'break-all font-mono text-xs',
          bold ? 'font-semibold text-foreground' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  )
}
