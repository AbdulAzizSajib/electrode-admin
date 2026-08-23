import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2, XCircle, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context'
import { useReturn, useUpdateReturnStatus, type ReturnStatus } from '@/lib/api/returns'
import { useWarehouses } from '@/lib/api/warehouses'
import { formatDateTime } from '@/lib/utils/format'

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<ReturnStatus, 'secondary' | 'warning' | 'destructive' | 'info' | 'success'> = {
  REQUESTED: 'secondary',
  APPROVED: 'warning',
  REJECTED: 'destructive',
  RECEIVED: 'info',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
}

export default function ReturnDetailPage() {
  const { returnId } = useParams()
  const navigate = useNavigate()
  const { data: ret, isLoading } = useReturn(returnId)
  const { data: warehousesData } = useWarehouses()
  const updateStatus = useUpdateReturnStatus()

  const [completeOpen, setCompleteOpen] = React.useState(false)
  const [warehouseId, setWarehouseId] = React.useState('')
  const [statusOpen, setStatusOpen] = React.useState(false)
  const [pickedStatus, setPickedStatus] = React.useState<ReturnStatus>('REQUESTED')

  useBreadcrumbLabel(ret ? `Return — ${ret.order.orderNumber}` : undefined)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!ret) return <EmptyState title="Return request not found" />

  const setStatus = (status: ReturnStatus, warehouseIdArg?: string) => {
    updateStatus.mutate(
      { id: ret.id, input: { status, warehouseId: warehouseIdArg } },
      {
        onSuccess: () => {
          toast({ title: `Return ${STATUS_LABEL[status]}` })
          setCompleteOpen(false)
          setStatusOpen(false)
        },
        onError: (err) => toast({ title: 'Could not update return', description: err.message, variant: 'destructive' }),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => navigate('/sales/returns')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          className="flex-1"
          title={`Return — ${ret.order.orderNumber}`}
          description={ret.returnNumber}
          actions={
            <>
              <Badge variant={STATUS_VARIANT[ret.status]} className="mr-1">{STATUS_LABEL[ret.status]}</Badge>
              {ret.status === 'REQUESTED' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStatus('APPROVED')}><CheckCircle2 /> Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setStatus('REJECTED')}><XCircle /> Reject</Button>
                </>
              )}
              {ret.status !== 'COMPLETED' && ret.status !== 'CANCELLED' && (
                <Button size="sm" onClick={() => setCompleteOpen(true)}>
                  <CheckCircle2 /> Complete & restock
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setPickedStatus(ret.status); setStatusOpen(true) }}
              >
                <Settings2 /> Set status
              </Button>
            </>
          }
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm">
          {ret.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span>{item.orderItem.productName}</span>
              <span className="text-muted-foreground">Qty {item.quantity}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reason</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-foreground">{ret.reason}</p>
          {ret.description && <p className="text-sm text-muted-foreground">{ret.description}</p>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Requested {formatDateTime(ret.createdAt)} · Updated {formatDateTime(ret.updatedAt)}</p>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete return</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Select the warehouse to restock these items into.</p>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
              <SelectContent>
                {warehousesData?.data.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button disabled={!warehouseId} loading={updateStatus.isPending} onClick={() => setStatus('COMPLETED', warehouseId)}>
              Confirm & restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set return status</DialogTitle></DialogHeader>
          <Select value={pickedStatus} onValueChange={(v) => setPickedStatus(v as ReturnStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pickedStatus === 'COMPLETED' && (
            <p className="text-xs text-muted-foreground">Use "Complete & restock" instead — completing here without a warehouse will be rejected by the backend.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button
              disabled={pickedStatus === 'COMPLETED'}
              loading={updateStatus.isPending}
              onClick={() => setStatus(pickedStatus)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
