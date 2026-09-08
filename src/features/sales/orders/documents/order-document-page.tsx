/**
 * Route target for `/sales/orders/:orderId/print/:document`.
 *
 * Reads the order from the same `useOrder` projection the detail page uses, so
 * a document can never disagree with the screen it was printed from — there is
 * no separate document endpoint and nothing is persisted. See design.md
 * Decision 7.
 *
 * Payments come off the order detail response rather than a second query: the
 * staff projection already includes them, and the invoice needs them to state
 * the balance due.
 */
import { useParams } from 'react-router'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder } from '@/lib/api/orders'
import { useStoreSettings } from '@/lib/api/store-settings'
import { PrintFrame, type DocumentKind } from './print-frame'
import { PackingSlip } from './packing-slip'
import { Invoice } from './invoice'
import { ShippingLabel } from './shipping-label'

const TITLE: Record<DocumentKind, string> = {
  'packing-slip': 'Packing slip',
  invoice: 'Invoice',
  'shipping-label': 'Shipping label',
}

const isDocumentKind = (value: string | undefined): value is DocumentKind =>
  value === 'packing-slip' || value === 'invoice' || value === 'shipping-label'

export default function OrderDocumentPage() {
  const { orderId, document: documentParam } = useParams()
  const { data: order, isLoading } = useOrder(orderId)
  const { data: settings } = useStoreSettings()

  if (!isDocumentKind(documentParam)) {
    return <EmptyState title="Unknown document" description="No such document for this order." />
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!order) return <EmptyState title="Order not found" />

  const backTo = `/sales/orders/${order.id}`

  return (
    <PrintFrame
      kind={documentParam}
      title={`${TITLE[documentParam]} — ${order.orderNumber}`}
      backTo={backTo}
    >
      {(size) => {
        if (documentParam === 'packing-slip') {
          return <PackingSlip order={order} settings={settings} />
        }
        if (documentParam === 'invoice') {
          return <Invoice order={order} payments={order.payments ?? []} settings={settings} />
        }
        return <ShippingLabel order={order} settings={settings} size={size} />
      }}
    </PrintFrame>
  )
}
