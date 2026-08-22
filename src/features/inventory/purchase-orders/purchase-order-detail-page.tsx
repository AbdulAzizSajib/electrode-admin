import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, PackageCheck, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useSuppliers } from '@/lib/api/suppliers'
import { useWarehouses } from '@/lib/api/warehouses'
import { useProducts } from '@/lib/api/products'
import { useDeletePurchaseOrder, usePurchaseOrder, useReceivePurchaseOrder, poTotal, type PurchaseOrderStatus } from '@/lib/api/purchase-orders'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  pending: 'Pending',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
}
const STATUS_VARIANT: Record<PurchaseOrderStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  pending: 'secondary',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'destructive',
}

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const { data: po, isLoading } = usePurchaseOrder(poId)
  const { data: suppliersData } = useSuppliers()
  const { data: warehousesData } = useWarehouses()
  const { data: productsData } = useProducts({ limit: 200 })
  const receiveMutation = useReceivePurchaseOrder()
  const deleteMutation = useDeletePurchaseOrder()
  const confirmDialog = useConfirmDialog()

  const [receiveOpen, setReceiveOpen] = React.useState(false)
  const [receiveQuantities, setReceiveQuantities] = React.useState<Record<string, number>>({})

  useBreadcrumbLabel(po?.poNumber)

  const productName = (id: string) => productsData?.data.find((p) => p.id === id)?.name ?? 'Unknown product'
  const supplierName = suppliersData?.data.find((s) => s.id === po?.supplierId)?.name ?? '—'
  const warehouseName = warehousesData?.data.find((w) => w.id === po?.warehouseId)?.name ?? '—'

  const openReceiveDialog = () => {
    if (!po) return
    const defaults: Record<string, number> = {}
    po.items.forEach((item) => {
      defaults[item.productId] = Math.max(0, item.quantityOrdered - item.quantityReceived)
    })
    setReceiveQuantities(defaults)
    setReceiveOpen(true)
  }

  const submitReceive = async () => {
    if (!po) return
    try {
      await receiveMutation.mutateAsync({
        id: po.id,
        receipts: Object.entries(receiveQuantities).map(([productId, quantity]) => ({ productId, quantity })),
      })
      toast({ title: 'Receipt recorded', description: 'Stock and status have been updated.' })
      setReceiveOpen(false)
    } catch (err) {
      toast({ title: 'Could not record receipt', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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

  const hasReceived = po.items.some((i) => i.quantityReceived > 0)
  const canReceive = po.status === 'pending' || po.status === 'partially_received'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/inventory/purchase-orders')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={po.poNumber}
          description={supplierName}
          actions={
            <>
              <Badge variant={STATUS_VARIANT[po.status]} className="mr-1">{STATUS_LABEL[po.status]}</Badge>
              {canReceive && (
                <Button size="sm" onClick={openReceiveDialog}>
                  <PackageCheck /> Receive
                </Button>
              )}
              {po.status === 'pending' && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/inventory/purchase-orders/${po.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
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
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium text-foreground">{productName(item.productId)}</TableCell>
                  <TableCell>{item.quantityOrdered}</TableCell>
                  <TableCell>{item.quantityReceived}</TableCell>
                  <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                  <TableCell>{formatCurrency(item.quantityOrdered * item.unitCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Warehouse: {warehouseName}</span>
          <span className="font-semibold text-foreground">Total: {formatCurrency(poTotal(po))}</span>
        </div>
      </Card>

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
            <DialogTitle>Receive items — {po.poNumber}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {po.items.map((item) => {
              const remaining = item.quantityOrdered - item.quantityReceived
              return (
                <div key={item.productId} className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{productName(item.productId)}</span>
                    <span className="text-xs text-muted-foreground">{remaining} remaining of {item.quantityOrdered}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    className="w-24"
                    value={receiveQuantities[item.productId] ?? 0}
                    onChange={(e) =>
                      setReceiveQuantities((prev) => ({ ...prev, [item.productId]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)) }))
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
