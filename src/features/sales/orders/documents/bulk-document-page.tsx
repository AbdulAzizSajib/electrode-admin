/**
 * Route target for `/sales/orders/print/:document?ids=…`.
 *
 * Produces one document per selected order in a single view, so a packing
 * session is one print command rather than one per parcel.
 *
 * Every document is built from the same `getOrder` projection the single-order
 * route uses (via `useOrdersByIds`, which shares its cache key), so a batched
 * document can never disagree with the same document printed on its own.
 * Nothing is persisted and there is no batch endpoint — see design.md
 * Decision 2.
 */
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrdersByIds, type Order } from '@/lib/api/orders'
import { useStoreSettings } from '@/lib/api/store-settings'
import { PrintFrame, type DocumentKind } from './print-frame'
import { PackingSlip } from './packing-slip'
import { Invoice } from './invoice'
import { ShippingLabel } from './shipping-label'
import { composeBatch, parseSelectionIds } from './bulk-selection'

const TITLE: Record<DocumentKind, string> = {
  'packing-slip': 'Packing slips',
  invoice: 'Invoices',
  'shipping-label': 'Shipping labels',
}

const isDocumentKind = (value: string | undefined): value is DocumentKind =>
  value === 'packing-slip' || value === 'invoice' || value === 'shipping-label'


export default function BulkDocumentPage() {
  const { document: documentParam } = useParams()
  const [searchParams] = useSearchParams()

  const ids = useMemo(() => parseSelectionIds(searchParams.get('ids')), [searchParams])

  const results = useOrdersByIds(ids)
  const { data: settings } = useStoreSettings()

  if (!isDocumentKind(documentParam)) {
    return <EmptyState title="Unknown document" description="No such document for these orders." />
  }

  if (ids.length === 0) {
    return (
      <EmptyState
        title="No orders selected"
        description="Select orders from the list and choose a document to print."
      />
    )
  }

  /*
   * All-or-nothing: a batch renders only once every order has settled.
   * Rendering progressively would let an operator print six labels out of
   * twelve with nothing on screen to say the rest were still arriving — and a
   * short batch looks exactly like a correct one on paper.
   */
  if (results.some((result) => result.isPending)) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const loaded = results
    .map((result) => result.data)
    .filter((order): order is Order => Boolean(order))

  const { printable, excluded, unreachable } = composeBatch(ids, loaded)

  if (printable.length === 0) {
    return (
      <EmptyState
        title="Nothing to print"
        description={
          excluded.length > 0
            ? `All ${excluded.length} selected order${excluded.length === 1 ? ' is' : 's are'} cancelled, so there is no parcel to produce paper for.`
            : 'None of the selected orders could be loaded.'
        }
      />
    )
  }

  /*
   * Everything the operator must see but must never print. Carried in the
   * frame's `notice` slot, which is inside `no-print`.
   *
   * Stated rather than silent on purpose: the merchant's workflow is filter,
   * select all, print — so a cancelled order reaching a batch means the filter
   * did not do what they thought. Twelve selected and ten printed is a
   * discrepancy they should be told about, not left to recount.
   */
  const notice =
    excluded.length > 0 || unreachable > 0 ? (
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        {excluded.length > 0 && (
          <p>
            <span className="font-medium">
              {excluded.length} order{excluded.length === 1 ? '' : 's'} excluded
            </span>{' '}
            — cancelled, so no document was produced:{' '}
            {excluded.map((order) => order.orderNumber).join(', ')}
          </p>
        )}
        {unreachable > 0 && (
          <p className={excluded.length > 0 ? 'mt-1' : undefined}>
            <span className="font-medium">
              {unreachable} order{unreachable === 1 ? '' : 's'} could not be loaded
            </span>{' '}
            — the documents below are still printable.
          </p>
        )}
      </div>
    ) : null

  return (
    <PrintFrame
      kind={documentParam}
      title={`${TITLE[documentParam]} — ${printable.length} order${printable.length === 1 ? '' : 's'}`}
      backTo="/sales/orders"
      backLabel="Back to orders"
      count={printable.length}
      notice={notice}
    >
      {(size) =>
        printable.map((order) => (
          // `print-batch-item` carries the page break; `print-doc` is per
          // document rather than around the batch, so each gets its own sheet.
          <div key={order.id} className="print-doc print-batch-item" data-size={size}>
            {documentParam === 'packing-slip' && <PackingSlip order={order} settings={settings} />}
            {documentParam === 'invoice' && (
              <Invoice order={order} payments={order.payments ?? []} settings={settings} />
            )}
            {documentParam === 'shipping-label' && (
              <ShippingLabel order={order} settings={settings} size={size} />
            )}
          </div>
        ))
      }
    </PrintFrame>
  )
}
