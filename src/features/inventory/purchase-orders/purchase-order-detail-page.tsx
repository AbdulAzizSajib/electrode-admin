import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, PackageCheck, Pencil, Trash2, Ban, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useWarehouses } from '@/lib/api/warehouses'
import {
  useDeletePurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrderStatus,
} from '@/lib/api/purchase-orders'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { SupplierPaymentsCard } from '@/features/inventory/purchase-orders/components/supplier-payments-card'

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<PurchaseOrderStatus, 'secondary' | 'info' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  ORDERED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
}

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const { data: po, isLoading } = usePurchaseOrder(poId)
  const { data: warehousesData } = useWarehouses()
  const receiveMutation = useReceivePurchaseOrder()
  const updateMutation = useUpdatePurchaseOrder()
  const deleteMutation = useDeletePurchaseOrder()
  const confirmDialog = useConfirmDialog()

  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [receiveWarehouseId, setReceiveWarehouseId] = React.useState('')
  const [receiveQuantities, setReceiveQuantities] = React.useState<Record<string, number>>({})

  useBreadcrumbLabel(po?.purchaseNumber)

  const openReceiveDialog = () => {
    if (!po) return
    const defaults: Record<string, number> = {}
    po.items.forEach((item) => {
      defaults[item.id] = Math.max(0, item.quantity - item.receivedQuantity)
    })
    setReceiveQuantities(defaults)
    setReceiveWarehouseId('')
    setReceiveOpen(true)
  }

  const submitReceive = async () => {
    if (!po) return
    if (!receiveWarehouseId) {
      toast({ title: 'Select a warehouse to receive into', variant: 'destructive' })
      return
    }
    try {
      await receiveMutation.mutateAsync({
        id: po.id,
        input: {
          warehouseId: receiveWarehouseId,
          items: Object.entries(receiveQuantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([purchaseOrderItemId, quantity]) => ({ purchaseOrderItemId, quantity })),
        },
      })
      toast({ title: 'Receipt recorded', description: 'Stock and status have been updated.' })
      setReceiveOpen(false)
    } catch (err) {
      toast({ title: 'Could not record receipt', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  const setStatus = async (status: 'ORDERED' | 'CANCELLED') => {
    if (!po) return
    try {
      await updateMutation.mutateAsync({ id: po.id, input: { status } })
      toast({ title: status === 'ORDERED' ? 'Marked as ordered' : 'Purchase order cancelled' })
    } catch (err) {
      toast({ title: 'Could not update status', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!po) return <EmptyState title="Purchase order not found" />

  const hasReceived = po.items.some((i) => i.receivedQuantity > 0)
  const canReceive = po.status !== 'CANCELLED' && po.status !== 'RECEIVED'
  const canEdit = po.status === 'DRAFT' || po.status === 'ORDERED'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/inventory/purchase-orders')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={po.purchaseNumber}
          description={po.supplier.name}
          actions={
            <>
              <Badge variant={STATUS_VARIANT[po.status]} className="mr-1">{STATUS_LABEL[po.status]}</Badge>
              {po.status === 'DRAFT' && (
                <Button variant="outline" size="sm" onClick={() => setStatus('ORDERED')} loading={updateMutation.isPending}>
                  <Send /> Mark as ordered
                </Button>
              )}
              {canReceive && (
                <Button size="sm" onClick={openReceiveDialog}>
                  <PackageCheck /> Receive
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/inventory/purchase-orders/${po.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setStatus('CANCELLED')} loading={updateMutation.isPending}>
                  <Ban /> Cancel
                </Button>
              )}
              {!hasReceived && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    confirmDialog.confirm(async () => {
                      try {
                        await deleteMutation.mutateAsync(po.id)
                        toast({ title: 'Purchase order deleted' })
                        navigate('/inventory/purchase-orders')
                      } catch (err) {
                        toast({ title: 'Could not delete', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                      }
                    })
                  }
                >
                  <Trash2 /> Delete
                </Button>
              )}
            </>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">{item.product.name}</TableCell>
                  {/* An em dash, not blank: a simple product has no variant to name,
                      which is different from one whose variant went unrecorded. */}
                  <TableCell className="text-muted-foreground">{item.variant?.name ?? '—'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.receivedQuantity}</TableCell>
                  <TableCell>{formatCurrency(Number(item.unitCost))}</TableCell>
                  <TableCell>{formatCurrency(Number(item.totalCost))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex flex-col items-end gap-0.5 border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Subtotal: {formatCurrency(Number(po.subtotal))}</span>
          <span className="text-muted-foreground">Shipping: {formatCurrency(Number(po.shippingCost))}</span>
          <span className="text-muted-foreground">Tax: {formatCurrency(Number(po.taxAmount))}</span>
          <span className="font-semibold text-foreground">Total: {formatCurrency(Number(po.totalAmount))}</span>
        </div>
      </Card>

      <SupplierPaymentsCard
        purchaseOrderId={po.id}
        purchaseNumber={po.purchaseNumber}
        supplierName={po.supplier.companyName || po.supplier.name}
        status={po.status}
      />

      {po.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-foreground">{po.notes}</p></CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Created {formatDateTime(po.createdAt)} · Updated {formatDateTime(po.updatedAt)}</p>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive items — {po.purchaseNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Warehouse</span>
              <Select value={receiveWarehouseId} onValueChange={setReceiveWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehousesData?.data.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {po.items.map((item) => {
              const remaining = item.quantity - item.receivedQuantity
              return (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    {/* Two lines of the same variable product are otherwise
                        indistinguishable here, and the quantities would be
                        entered against whichever row happened to come first. */}
                    <span className="text-sm font-medium text-foreground">
                      {item.product.name}
                      {item.variant ? ` — ${item.variant.name}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{remaining} remaining of {item.quantity}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    className="w-24"
                    disabled={remaining <= 0}
                    value={receiveQuantities[item.id] ?? 0}
                    onChange={(e) =>
                      setReceiveQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)) }))
                    }
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={submitReceive} loading={receiveMutation.isPending}>Confirm receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this purchase order?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
