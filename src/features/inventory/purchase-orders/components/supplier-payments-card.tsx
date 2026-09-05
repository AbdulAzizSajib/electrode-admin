import * as React from 'react'
import { CreditCard, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  SUPPLIER_PAYMENT_METHODS,
  useDeleteSupplierPayment,
  useRecordSupplierPayment,
  useSupplierPayments,
  type SupplierPaymentMethod,
} from '@/lib/api/supplier-payments'
import type { PurchaseOrderStatus } from '@/lib/api/purchase-orders'
import { formatCurrency, formatDate } from '@/lib/utils/format'

/**
 * What the store has paid a supplier against this purchase order.
 *
 * Mirrors the Payments card on the order detail page, which does the same for
 * money coming in — but with delete, because a supplier payment records
 * something that happened outside the system and a merchant who typed the
 * wrong amount must be able to undo it.
 *
 * Deliberately NOT a ledger: no debit/credit columns, no running account
 * balance. Rows, a total, and what is still due.
 */
const SETTLEMENT_LABEL = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Part paid',
  SETTLED: 'Settled',
} as const

const SETTLEMENT_VARIANT = {
  UNPAID: 'destructive',
  PARTIALLY_PAID: 'warning',
  SETTLED: 'success',
} as const

/** Today as `YYYY-MM-DD`, for the date input's default. */
const today = () => new Date().toISOString().slice(0, 10)

export function SupplierPaymentsCard({
  purchaseOrderId,
  purchaseNumber,
  supplierName,
  status,
}: {
  purchaseOrderId: string
  purchaseNumber: string
  supplierName: string
  status: PurchaseOrderStatus
}) {
  const { data, isLoading } = useSupplierPayments(purchaseOrderId)
  const recordMutation = useRecordSupplierPayment()
  const deleteMutation = useDeleteSupplierPayment()
  const confirmDialog = useConfirmDialog()

  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState<SupplierPaymentMethod>('CASH')
  const [paidAt, setPaidAt] = React.useState(today)
  const [reference, setReference] = React.useState('')
  const [note, setNote] = React.useState('')

  /*
   * A draft is not yet a commitment and a cancelled purchase order is a
   * withdrawn one, so neither can be paid. The server refuses both — hiding the
   * action here makes that a design rather than an error the merchant has to
   * trip over first (`inventory/supplier-payments`).
   */
  const canPay = status !== 'DRAFT' && status !== 'CANCELLED'
  const balanceDue = data?.balanceDue ?? 0

  const openDialog = () => {
    // Prefilled with what is still owed: settling in full is the common case.
    setAmount(balanceDue > 0 ? String(balanceDue) : '')
    setMethod('CASH')
    setPaidAt(today())
    setReference('')
    setNote('')
    setOpen(true)
  }

  const submit = async () => {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: 'Enter an amount greater than zero', variant: 'destructive' })
      return
    }

    try {
      await recordMutation.mutateAsync({
        purchaseOrderId,
        input: {
          amount: parsed,
          method,
          paidAt: new Date(`${paidAt}T00:00:00`).toISOString(),
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        },
      })
      toast({ title: 'Payment recorded' })
      setOpen(false)
    } catch (err) {
      // The server names the outstanding balance when an amount overshoots, so
      // its message is more useful than anything invented here.
      toast({
        title: 'Could not record payment',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            Payments to supplier
            {data && (
              <Badge variant={SETTLEMENT_VARIANT[data.settlementState]}>
                {SETTLEMENT_LABEL[data.settlementState]}
              </Badge>
            )}
          </CardTitle>
          {canPay && balanceDue > 0 && (
            <Button size="sm" variant="outline" onClick={openDialog}>
              <CreditCard /> Record payment
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <Figure label="Total" value={data?.totalAmount ?? 0} />
            <Figure label="Paid" value={data?.amountPaid ?? 0} tone="positive" />
            <Figure label="Due" value={balanceDue} tone={balanceDue > 0 ? 'negative' : 'muted'} />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading payments…</p>
          ) : !data || data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments recorded yet.
              {!canPay && ' This purchase order cannot be paid in its current status.'}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-foreground">
                      {SUPPLIER_PAYMENT_METHODS.find((m) => m.value === payment.method)?.label ??
                        payment.method}
                      {payment.reference && ` · ${payment.reference}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(payment.paidAt)}
                      {payment.note && ` · ${payment.note}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {formatCurrency(Number(payment.amount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      aria-label="Delete payment"
                      onClick={() =>
                        confirmDialog.confirm(async () => {
                          try {
                            await deleteMutation.mutateAsync({
                              purchaseOrderId,
                              paymentId: payment.id,
                            })
                            toast({ title: 'Payment removed' })
                          } catch (err) {
                            toast({
                              title: 'Could not remove payment',
                              description: err instanceof Error ? err.message : undefined,
                              variant: 'destructive',
                            })
                          }
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment — {purchaseNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {/* The supplier is shown, never chosen: it comes from the purchase
                order so a payment cannot name a supplier the purchase order
                does not belong to. */}
            <Field label="Supplier">
              <Input value={supplierName} disabled />
            </Field>

            <Field label="Amount" hint={`${formatCurrency(balanceDue)} still due`}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>

            <Field label="Method">
              <Select value={method} onValueChange={(value) => setMethod(value as SupplierPaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_PAYMENT_METHODS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Payment date" hint="Backdate this to record a payment made earlier">
              <Input
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </Field>

            <Field label="Reference" hint="Optional — cheque number, transaction id">
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </Field>

            <Field label="Note" hint="Optional">
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={recordMutation.isPending}>
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Remove this payment?"
        description="The purchase order's paid and due figures will be recalculated without it."
        confirmLabel="Remove"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </>
  )
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'positive' | 'negative' | 'muted'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-success'
      : tone === 'negative'
        ? 'text-destructive'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground'
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold ${toneClass}`}>{formatCurrency(value)}</span>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
