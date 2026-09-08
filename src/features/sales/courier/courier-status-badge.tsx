import { Badge } from '@/components/ui/badge'
import { courierStatusLabel } from '@/features/sales/courier/courier-presentation'

type BadgeVariant = 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive'

const COURIER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  in_review: 'secondary',
  pending: 'default',
  hold: 'warning',
  delivered: 'success',
  partial_delivered: 'warning',
  cancelled: 'destructive',
  unknown: 'warning',
  delivered_approval_pending: 'info',
  partial_delivered_approval_pending: 'warning',
  cancelled_approval_pending: 'warning',
  unknown_approval_pending: 'warning',
}

export function CourierStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>

  return (
    <Badge variant={COURIER_STATUS_VARIANT[status] ?? 'secondary'}>
      {courierStatusLabel(status)}
    </Badge>
  )
}
