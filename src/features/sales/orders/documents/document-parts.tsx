/**
 * Pieces the three fulfilment documents share.
 *
 * Kept together so the store's identity and the recipient's address read
 * identically on a packing slip, an invoice and a label — a picker matching a
 * slip against a parcel should not have to reconcile two different renderings
 * of the same address.
 */
import type { Order, OrderShippingAddress } from '@/lib/api/orders'
import type { StoreSettings } from '@/lib/api/store-settings'
import { formatDate } from '@/lib/utils/format'

/** Store name and contact details, for the top of a document. */
export function StoreIdentity({
  settings,
  showLogo = false,
}: {
  settings: StoreSettings | undefined
  /**
   * Logos are off by default. On thermal paper a logo prints slowly and with
   * poor contrast, and the label has no room for one; the invoice opts in.
   */
  showLogo?: boolean
}) {
  if (!settings) return null

  const contact = [settings.contactPhone, settings.contactEmail].filter(Boolean).join(' · ')

  return (
    <div className="section">
      {showLogo && settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt=""
          style={{ maxHeight: '18mm', maxWidth: '60mm', marginBottom: '2mm' }}
        />
      ) : null}
      <div style={{ fontWeight: 700 }}>{settings.storeName}</div>
      {settings.address ? <div className="muted">{settings.address}</div> : null}
      {contact ? <div className="muted">{contact}</div> : null}
    </div>
  )
}

/**
 * A delivery address.
 *
 * Renders a collection notice when there is none rather than an empty block —
 * a label with a blank address looks like a rendering bug and tells the packer
 * nothing. Required by the spec's collection-order scenario.
 */
export function AddressBlock({
  address,
  fallbackName,
  heading = 'Deliver to',
}: {
  address: OrderShippingAddress | null
  /** Used when the order has no address of its own — the customer's own name. */
  fallbackName?: string
  heading?: string
}) {
  if (!address) {
    return (
      <div className="section">
        <div style={{ fontWeight: 700 }}>Collection</div>
        <div>{fallbackName ?? '—'}</div>
        <div className="muted">This order is collected in store, not delivered.</div>
      </div>
    )
  }

  const locality = [address.city, address.state, address.postalCode].filter(Boolean).join(', ')

  return (
    <div className="section">
      <div className="muted">{heading}</div>
      <div style={{ fontWeight: 700 }}>{address.fullName}</div>
      <div>{address.addressLine1}</div>
      {address.addressLine2 ? <div>{address.addressLine2}</div> : null}
      {locality ? <div>{locality}</div> : null}
      {address.country ? <div>{address.country}</div> : null}
      {address.phone ? <div>{address.phone}</div> : null}
    </div>
  )
}

/** Order number and placement date, the two identifiers every document carries. */
export function OrderMeta({ order, label }: { order: Order; label: string }) {
  return (
    <div className="section" style={{ marginBottom: '3mm' }}>
      <div className="doc-title">{label}</div>
      <div style={{ fontWeight: 700 }}>{order.orderNumber}</div>
      <div className="muted">Placed {formatDate(order.createdAt)}</div>
    </div>
  )
}

/** A horizontal rule that survives thermal printing (a border, never a fill). */
export function Rule() {
  return <div style={{ borderTop: '0.3mm solid #000', margin: '2.5mm 0' }} />
}
