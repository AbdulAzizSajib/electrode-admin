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
import { CHANNEL_LABEL, ORDER_STATUSES, useOrder, useUpdateOrderStatus, type OrderStatus } from '@/lib/api/orders'
import { useStaffUser } from '@/lib/api/staff-users'
import { Thumbnail } from '@/components/ui/thumbnail'
import {
  hasClaimDetails,
  isUndecidedClaim,
  usePaymentsByOrder,
  useRecordPayment,
  useRejectPayment,
  useVerifyPayment,
  type PaidToAccountSnapshot,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/api/payments'
import { useShipmentByOrder } from '@/lib/api/shipments'
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

/**
 * Payment methods in the panel's voice, for the same reason
 * `PAYMENT_STATUS_LABEL` exists: `BANK_TRANSFER` in a sentence beside a
 * human date reads as a database dump.
 *
 * Only the advance methods and COD are spelled out — the claim panel and the
 * payment list are the two places a method is read in prose, and the gateway
 * methods appear in neither on a shop with no gateway integrated. Anything not
 * listed falls back to its own value with the underscore taken out.
 */
const PAYMENT_METHOD_LABEL: Partial<Record<PaymentMethod, string>> = {
  COD: 'Cash on delivery',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
  BANK_TRANSFER: 'Bank transfer',
}

const paymentMethodLabel = (method: PaymentMethod) =>
  PAYMENT_METHOD_LABEL[method] ?? method.replace(/_/g, ' ')

/**
 * The merchant account a claim names, as one line the operator can match
 * against a statement.
 *
 * Read from the SNAPSHOT taken at placement, never from current settings. The
 * merchant may have edited or deleted the account since, and a claim that cannot
 * say which number the shopper actually sent to is unreviewable — which is why
 * the snapshot is stored at all (design.md Decision 2).
 *
 * Falls back to the account id when there is no snapshot, which is the honest
 * answer rather than a blank: the id is still what the claim references.
 */
const describeAccount = (
  snapshot: PaidToAccountSnapshot | null,
  accountId: string | null,
): string => {
  if (!snapshot) return accountId ?? '—'

  if (snapshot.number) {
    const provider = snapshot.provider
      ? (PAYMENT_METHOD_LABEL[snapshot.provider as PaymentMethod] ?? snapshot.provider)
      : ''
    const type = snapshot.accountType ? ` (${snapshot.accountType})` : ''
    return `${provider} ${snapshot.number}${type}`.trim()
  }

  if (snapshot.accountNumber) {
    const parts = [snapshot.bankName, snapshot.accountNumber, snapshot.accountName].filter(Boolean)
    const branch = snapshot.branch ? ` · ${snapshot.branch}` : ''
    return `${parts.join(' · ')}${branch}`
  }

  return accountId ?? '—'
}

/** The staff member who decided a claim, however much of them the API returned. */
const describeVerifier = (payment: Payment): string =>
  payment.verifiedBy?.name ?? payment.verifiedBy?.email ?? 'a staff member'
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
/*
 * There is no SHIPMENT_STATUS_LABEL here any more, and no shipment form.
 *
 * The panel used to carry a Shipment card beside the Courier one, with a dialog
 * over carrier / tracking number / an eight-value shipment status. It was
 * removed because nothing read what it wrote: the printed documents never
 * mention a carrier or a tracking number, the storefront's /track-order page
 * shows `order.status` and nothing else, and no report or list touches a
 * shipment. An operator typed three fields in so they could look at those same
 * three fields on the same page.
 *
 * It also cost more than nothing. It put a third status enum on a page that
 * already has two — order status and payment status — with no stated relation
 * between them and no sync in either direction, so an order could read SHIPPED
 * beside a shipment reading Pending and the panel would not object. And on a
 * shop with an integrated courier the card was actively misleading: dispatch
 * overwrites carrier, tracking and status from the courier's response
 * (courier.service.ts, `recordConsignment`), so anything entered by hand
 * beforehand was thrown away.
 *
 * A shipment is still created, read and kept current — by the courier, through
 * dispatch and the delivery webhook. The Courier card below is where it
 * surfaces. The POST/PATCH `/orders/:id/shipment` endpoints are untouched and
 * still in the Postman collection; what went is the admin's hand-entry UI, not
 * the API.
 */

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  method: z.enum(['COD', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER']),
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']),
})
type PaymentValues = z.input<typeof paymentSchema>
type PaymentOutput = z.output<typeof paymentSchema>

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
  /*
   * Who recorded this order, when a person did. `useStaffUser` is disabled
   * without an id, so a website order — which is most of them — makes no
   * request at all.
   */
  const { data: recordedBy } = useStaffUser(order?.createdByUserId ?? undefined)
  const { data: shipment } = useShipmentByOrder(orderId)
  const updateStatus = useUpdateOrderStatus()
  const recordPayment = useRecordPayment()
  const verifyPayment = useVerifyPayment()
  const rejectPayment = useRejectPayment()
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
  const [returnOpen, setReturnOpen] = React.useState(false)
  const [returnReason, setReturnReason] = React.useState('')
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState('')
  const confirmVerify = useConfirmDialog()

  useBreadcrumbLabel(order?.orderNumber)

  const paymentForm = useForm<PaymentValues, unknown, PaymentOutput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: 'CARD', status: 'PAID' },
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
   * The advance-payment claim on this order, if it has one.
   *
   * At most one exists — checkout creates a single payment row for the advance
   * and the remainder is the balance, not a second row (design.md Decision 3) —
   * but this takes the first match rather than asserting that, because a claim
   * silently not rendering would hide the control that releases the order.
   *
   * A claim that has been decided still has to be shown, so this is not the
   * undecided predicate: `hasClaimDetails` asks whether there is a claim to
   * READ, `isUndecidedClaim` asks whether one is owed a decision.
   */
  const claim = (payments ?? []).find(hasClaimDetails) ?? null
  const claimUndecided = claim !== null && isUndecidedClaim(claim)

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
   * Confirms that the money a shopper claimed to have sent actually arrived.
   *
   * THE OPERATOR IS THE VERIFICATION. Nothing here or on the server checks a
   * bank statement — this records that a person said they read one. Hence the
   * confirm step: a mis-clicked Verify releases an order against money that may
   * never have been sent, and the audit log will name whoever clicked it.
   *
   * On success the order becomes confirmable straight away, without a reload:
   * `useVerifyPayment` invalidates the order detail alongside the payment list,
   * so the status control's `allowedTransitions` are refetched with it.
   */
  const submitVerify = async () => {
    if (!orderId || !claim) return
    try {
      await verifyPayment.mutateAsync({ orderId, paymentId: claim.id })
      toast({ title: 'Payment verified — the order can now be confirmed' })
    } catch (err) {
      toast({
        title: 'Could not verify the payment',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  /**
   * Records that the claimed money did not arrive, with the grounds.
   *
   * The reason is required by the server and required here, because a rejection
   * nobody can be told the grounds for is not actionable by the shopper who is
   * out of pocket or by the next operator who opens the order. The button is
   * disabled rather than the save being attempted and refused.
   *
   * Rejecting does NOT free the transaction reference. The shopper cannot
   * resubmit the same id on a new order and hope for a different operator —
   * said in the dialog, because it is the one consequence that is not obvious.
   */
  const submitReject = async () => {
    if (!orderId || !claim) return
    try {
      await rejectPayment.mutateAsync({ orderId, paymentId: claim.id, reason: rejectReason.trim() })
      toast({ title: 'Payment rejected — the order stays blocked' })
      setRejectOpen(false)
      setRejectReason('')
    } catch (err) {
      toast({
        title: 'Could not reject the payment',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
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

  /**
   * Whether this order has a courier surface at all.
   *
   * True when the shop's courier can dispatch — the card is then where that
   * happens — or when this parcel is already out with one. The second half is
   * not redundant: a shop that switches to MANUAL still has consignments in
   * flight under the old courier, and hiding those would strand the consignment
   * id and tracking code that are the only record of where the box is.
   *
   * False on a shop with no dispatch integration and nothing dispatched. That
   * combination is what the card used to render as a paragraph explaining that
   * it could do nothing, below a Shipment card whose hand-typed carrier and
   * tracking number no document, report or storefront page ever read. Both are
   * gone; the status timeline in the right column is the fulfilment record for
   * a shop that hands parcels over itself.
   */
  const showCourierCard = isCourierOwned || Boolean(courier?.capabilities.dispatch)

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
                        {/* The picture beside the name, for the same reason the
                            orders list carries one: whoever is packing this box
                            is matching it against a shelf. A line with no image
                            gets a same-sized placeholder, so rows stay level. */}
                        <div className="flex items-center gap-3">
                          <Thumbnail url={item.image} className="size-10" />
                          <div className="min-w-0">
                            {item.productName}
                            <div className="text-xs font-normal text-muted-foreground">{item.sku}</div>
                          </div>
                        </div>
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
                {Number(order.discountAmount) > 0 && (
                  <>
                    <Row label="Discount" value={`-${formatCurrency(Number(order.discountAmount))}`} />
                    {/*
                      Why, when a person decided it. A staff discount has no
                      coupon code to point at, so without this the order carries
                      an unexplained hole in the day's takings once the
                      conversation that produced it is gone. Absent for a coupon
                      discount, which `couponCode` already explains.
                    */}
                    {order.discountReason && (
                      <p className="-mt-0.5 text-xs text-muted-foreground">{order.discountReason}</p>
                    )}
                  </>
                )}
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

          {/*
           * What the shopper says they sent, and what was decided about it.
           *
           * Its own card rather than a block inside Payments, because the two
           * answer different questions: that card is the ledger of money on this
           * order, this one is a review the operator has to act on. The balance
           * due stays over there and needs no change — an advance of ৳130 against
           * a ৳920 order already derives to ৳790 owed.
           *
           * Absent entirely on an order with no claim, which is every order on a
           * shop with advance payment off.
           *
           * The controls are NOT wrapped in `RequireRole`, matching the Record an
           * order button on the orders list and for the same reason: the backend
           * gates verify and reject on ADMIN_PANEL_ROLES, which is OWNER/ADMIN/
           * STAFF — every role that can sign into this panel. A `RequireRole`
           * naming all three would read as a restriction while hiding the buttons
           * from nobody. The server re-checks the role on both routes regardless.
           */}
          {claim && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Advance payment</CardTitle>
                {claimUndecided && (
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      loading={verifyPayment.isPending}
                      onClick={() => confirmVerify.confirm(submitVerify)}
                    >
                      {!verifyPayment.isPending && <CheckCircle2 />}
                      {verifyPayment.isPending ? 'Verifying…' : 'Verify'}
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => setRejectOpen(true)}>
                      Reject
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {/* The amount claimed leads, because it is what the operator
                    matches against the statement line they are looking at. */}
                <Row label="Amount claimed" value={formatCurrency(Number(claim.amount))} bold />
                <Row label="Method" value={paymentMethodLabel(claim.method)} />
                <Row
                  label="Sent to"
                  value={describeAccount(claim.paidToAccountSnapshot, claim.paidToAccountId)}
                />
                <Row label="Sender" value={claim.senderIdentifier ?? '—'} mono />
                {/* Monospaced like the courier identifiers above: this is the
                    value an operator compares character by character against a
                    statement, and a proportional font hides a transposed pair. */}
                <Row label="Reference" value={claim.transactionId ?? '—'} mono />

                <div className="mt-1 border-t border-border pt-2">
                  {claimUndecided ? (
                    <p className="flex items-start gap-1.5 text-warning">
                      <Ban className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Not verified yet. Check this reference against your{' '}
                        {paymentMethodLabel(claim.method)} statement — the order cannot be confirmed
                        or dispatched until you do. Cancelling it is still allowed.
                      </span>
                    </p>
                  ) : claim.status === 'PAID' ? (
                    <p className="flex items-start gap-1.5 text-success">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Verified by {describeVerifier(claim)}
                        {claim.verifiedAt ? ` on ${formatDateTime(claim.verifiedAt)}` : ''}.
                      </span>
                    </p>
                  ) : claim.status === 'FAILED' ? (
                    <div className="flex flex-col gap-1">
                      <p className="flex items-start gap-1.5 text-destructive">
                        <Ban className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Rejected by {describeVerifier(claim)}
                          {claim.verifiedAt ? ` on ${formatDateTime(claim.verifiedAt)}` : ''}. The
                          order stays blocked.
                        </span>
                      </p>
                      {claim.rejectionReason && (
                        <p className="pl-5 text-muted-foreground">
                          Reason: {claim.rejectionReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Any other status is a claim something else moved — a
                       refund, a cancellation. Stated rather than left blank, so
                       the panel never implies a decision nobody made. */
                    <p className="text-muted-foreground">
                      This claim is {PAYMENT_STATUS_LABEL[claim.status] ?? claim.status} and is no
                      longer awaiting a decision.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/*
           * The courier's own record of this parcel — the only delivery surface
           * on the page now that the hand-entered Shipment card beside it has
           * gone (see the note where SHIPMENT_STATUS_LABEL used to be). What is
           * shown here is written by dispatch and kept current by the delivery
           * webhook, so there is no longer a "what we typed" and a "what the
           * courier says" to keep apart.
           *
           * Rendered only when there is a courier in the picture at all. On a
           * shop set to MANUAL with nothing dispatched, this card's entire
           * content was a sentence explaining that the card could do nothing —
           * a box that exists to apologise for existing. It is absent instead,
           * and the status timeline is the fulfilment record.
           */}
          {showCourierCard && (
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
                /* Reached only on a shop whose courier CAN dispatch — a shop
                   that cannot has no card at all — so the branch that used to
                   explain the missing integration has gone with it. What is
                   left is the one thing an operator needs here: whether this
                   order is ready to go, and if not, why not. */
                <p className="text-sm text-muted-foreground">
                  {order.status === 'PACKED'
                    ? 'Not dispatched yet.'
                    : `Not dispatched. Only a packed order can be sent to the courier — this one is ${STATUS_LABEL[order.status].toLowerCase()}.`}
                </p>
              )}
            </CardContent>
          </Card>
          )}
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
            Only for orders a person recorded. Absent on a website order, which
            is the same reasoning the Campaign card below uses: a card reading
            "Recorded by: —" on every self-service order is noise, and the
            ABSENCE of a recorder is precisely what says the customer placed it
            themselves.

            The staff member is fetched by id and only when there is one, so an
            ordinary order costs no extra request. A deleted staff account
            leaves `createdByUserId` null (SetNull), so this card disappears
            rather than naming nobody — the transition is still attributed on
            the status timeline below, which records the same user.
          */}
          {order.createdByUserId && (
            <Card>
              <CardHeader><CardTitle>Recorded by staff</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">
                  {recordedBy?.name ?? recordedBy?.email ?? 'A staff member'}
                </span>
                <span className="text-muted-foreground">
                  Customer reached us on {CHANNEL_LABEL[order.channel ?? 'OTHER']}
                </span>
              </CardContent>
            </Card>
          )}

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

      {/* Rejecting a claim. The reason is required — the server refuses a blank
          one — so the button is disabled until there is one rather than the
          request being sent to be turned down. */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3.5">
            <p className="text-sm text-muted-foreground">
              The order stays blocked from being confirmed or dispatched. The transaction reference
              stays used up, so the same one cannot be submitted again on a new order.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reject-claim-reason" className="text-sm font-medium">
                Reason
              </label>
              <Input
                id="reject-claim-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="No payment found on the statement for this reference"
                maxLength={500}
              />
              <span className="text-xs text-muted-foreground">
                Recorded against the order and in the audit log. Say what you checked — the next
                person reading this order has only these words to go on.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectReason.trim() === ''}
              loading={rejectPayment.isPending}
              onClick={() => void submitReject()}
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmVerify.open}
        onOpenChange={confirmVerify.setOpen}
        title="Verify this payment?"
        /* Names what verifying actually asserts, and that it is attributable.
           Nothing in the system checks the money arrived — this records that a
           person said it did, and the audit log names who. */
        description="This records that the money arrived and releases the order to be confirmed and dispatched. Check the reference against your statement first — the decision is logged against your account."
        confirmLabel="Verify payment"
        variant="default"
        loading={confirmVerify.pending}
        onConfirm={confirmVerify.handleConfirm}
      />

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
