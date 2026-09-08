/**
 * Shipping label — what goes on the outside of the parcel.
 *
 * The barcode is the point of this document. It encodes the order number and
 * nothing else, so scanning a parcel anywhere downstream — the packing bench,
 * a courier's depot — yields exactly the string printed beneath it. That
 * equality is what makes the label useful and is asserted in code128.test.ts;
 * a barcode that encodes a decorated or truncated value would misroute parcels
 * while looking entirely correct.
 *
 * No logo, deliberately: on thermal paper a logo prints slowly and with poor
 * contrast, and the space is better spent on the address. The invoice carries
 * the store's branding instead.
 *
 * Money does not appear here. A label is visible in transit to anyone handling
 * the parcel, and what the customer paid is not their business.
 */
import type { Order } from '@/lib/api/orders'
import type { StoreSettings } from '@/lib/api/store-settings'
import { formatDate } from '@/lib/utils/format'
import type { PaperSize } from './print-frame'
import { Barcode } from './barcode'
import { AddressBlock, Rule } from './document-parts'

export function ShippingLabel({
  order,
  settings,
  size,
}: {
  order: Order
  settings: StoreSettings | undefined
  size: PaperSize
}) {
  const customerName = [order.customer.firstName, order.customer.lastName]
    .filter(Boolean)
    .join(' ')

  const itemCount = (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0)

  return (
    <>
      {/*
       * Sender first and small — a courier reads the recipient, and the return
       * address only matters if the parcel comes back.
       */}
      <div className="section muted" style={{ fontSize: '0.85em' }}>
        <div>From: {settings?.storeName ?? ''}</div>
        {settings?.address ? <div>{settings.address}</div> : null}
        {settings?.contactPhone ? <div>{settings.contactPhone}</div> : null}
      </div>

      <Rule />

      {/* The recipient block, set larger than anything else on the label. */}
      <div style={{ fontSize: size === 'thermal' ? '1.15em' : '1.35em' }}>
        <AddressBlock
          address={order.shippingAddress}
          fallbackName={customerName}
          heading="To"
        />
      </div>

      <Rule />

      <div className="section" style={{ textAlign: 'center' }}>
        <Barcode
          value={order.orderNumber}
          heightMm={size === 'thermal' ? 14 : 18}
          // One module at 0.33mm keeps the narrowest bar two to three dots wide
          // at 203 dpi; A4 laser has resolution to spare, so it can go wider.
          moduleMm={size === 'thermal' ? 0.33 : 0.4}
        />
      </div>

      <Rule />

      <div className="section muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{formatDate(order.createdAt)}</span>
        <span>
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
        {order.deliveryOptionLabel ? <span>{order.deliveryOptionLabel}</span> : null}
      </div>
    </>
  )
}
