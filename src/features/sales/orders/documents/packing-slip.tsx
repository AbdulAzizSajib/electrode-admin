/**
 * Packing slip — the picker's working document.
 *
 * Carries no money at all: no unit price, no line total, no order total, and in
 * particular no `unitCost`. That is a requirement rather than a layout choice.
 * The slip travels with the goods and is handled by whoever packs them, and the
 * merchant's buying cost must never be on a piece of paper that can end up in a
 * box. `unitCost` is not even present in this projection — the API strips it
 * for non-staff and nothing here reads it — but the prohibition is the point.
 *
 * What a picker actually needs is on it: what to fetch, how many, and the SKU
 * to confirm they fetched the right thing.
 */
import type { Order } from '@/lib/api/orders'
import type { StoreSettings } from '@/lib/api/store-settings'
import { AddressBlock, OrderMeta, Rule, StoreIdentity } from './document-parts'

export function PackingSlip({
  order,
  settings,
}: {
  order: Order
  settings: StoreSettings | undefined
}) {
  const items = order.items ?? []
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const customerName = [order.customer.firstName, order.customer.lastName]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <StoreIdentity settings={settings} />
      <Rule />
      <OrderMeta order={order} label="Packing slip" />

      <AddressBlock address={order.shippingAddress} fallbackName={customerName} />

      {order.deliveryOptionLabel ? (
        <div className="section" style={{ marginTop: '2mm' }}>
          <span className="muted">Delivery: </span>
          {order.deliveryOptionLabel}
        </div>
      ) : null}

      <Rule />

      <table>
        <thead>
          <tr>
            <th style={{ width: '8%' }}>#</th>
            <th>Item</th>
            <th className="num" style={{ width: '14%' }}>
              Qty
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.productId}-${item.variantId ?? 'base'}-${index}`}>
              <td>{index + 1}</td>
              <td>
                <div>{item.productName}</div>
                {item.sku ? <div className="muted">SKU {item.sku}</div> : null}
              </td>
              {/* Bold because this is the number the picker acts on. */}
              <td className="num" style={{ fontWeight: 700 }}>
                {item.quantity}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td style={{ fontWeight: 700 }}>
              {items.length} line{items.length === 1 ? '' : 's'}
            </td>
            <td className="num" style={{ fontWeight: 700 }}>
              {totalUnits}
            </td>
          </tr>
        </tfoot>
      </table>

      {order.notes ? (
        <>
          <Rule />
          <div className="section">
            <div className="muted">Order notes</div>
            <div>{order.notes}</div>
          </div>
        </>
      ) : null}

      <Rule />
      <div className="section muted">
        Picked by ______________________ Checked by ______________________
      </div>
    </>
  )
}
