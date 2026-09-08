/**
 * Invoice — the customer's copy, and what a courier reads to know what to
 * collect.
 *
 * Money here is presentation of figures the order already holds: subtotal,
 * discount, shipping, tax and total are printed as recorded, never recomputed.
 * Recomputing would let a rounding difference put a number on paper that
 * disagrees with what the customer was charged.
 *
 * Amount paid and balance due are derived the same way `order-detail-page.tsx`
 * derives them — PAID payments summed, balance floored at zero — so the invoice
 * and the admin screen cannot disagree. For a cash-on-delivery parcel that
 * balance is the operative number on the whole document.
 *
 * Every figure goes through `formatCurrency`, which applies the store's symbol,
 * position and decimal places. A store configured to 0 decimals therefore
 * prints whole numbers here without this file knowing anything about it.
 *
 * No per-item cost basis appears, per the spec. The staff order projection
 * carries `unitCost`; nothing on this document reads it.
 */
import type { Order } from '@/lib/api/orders'
import type { Payment } from '@/lib/api/payments'
import type { StoreSettings } from '@/lib/api/store-settings'
import { formatCurrency } from '@/lib/utils/format'
import { AddressBlock, OrderMeta, Rule, StoreIdentity } from './document-parts'

export function Invoice({
  order,
  payments,
  settings,
}: {
  order: Order
  payments: Payment[]
  settings: StoreSettings | undefined
}) {
  const items = order.items ?? []
  const customerName = [order.customer.firstName, order.customer.lastName]
    .filter(Boolean)
    .join(' ')

  const total = Number(order.totalAmount)
  const paid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0)
  // Floored at zero to match the detail page: an overpayment is a refund
  // question, not a negative amount to collect at the door.
  const due = Math.max(0, total - paid)

  const discount = Number(order.discountAmount)
  const shipping = Number(order.shippingAmount)
  const tax = Number(order.taxAmount)

  return (
    <>
      <div className="cols">
        <StoreIdentity settings={settings} showLogo />
        <OrderMeta order={order} label="Invoice" />
      </div>

      <Rule />

      <div className="cols">
        <AddressBlock
          address={order.shippingAddress}
          fallbackName={customerName}
          heading="Bill to"
        />
        <div className="section">
          {order.customer.phone ? <div>{order.customer.phone}</div> : null}
          {order.customer.email ? <div>{order.customer.email}</div> : null}
          {order.deliveryOptionLabel ? (
            <div className="muted" style={{ marginTop: '2mm' }}>
              {order.deliveryOptionLabel}
            </div>
          ) : null}
        </div>
      </div>

      <Rule />

      <table>
        <thead>
          <tr>
            <th style={{ width: '7%' }}>#</th>
            <th>Item</th>
            <th className="num" style={{ width: '10%' }}>
              Qty
            </th>
            <th className="num" style={{ width: '20%' }}>
              Unit
            </th>
            <th className="num" style={{ width: '22%' }}>
              Total
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
              <td className="num">{item.quantity}</td>
              <td className="num">{formatCurrency(Number(item.unitPrice))}</td>
              <td className="num">{formatCurrency(Number(item.totalPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals" style={{ width: '60%', marginTop: '3mm' }}>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td className="num">{formatCurrency(Number(order.subtotal))}</td>
          </tr>
          {discount > 0 ? (
            <tr>
              <td>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</td>
              <td className="num">−{formatCurrency(discount)}</td>
            </tr>
          ) : null}
          <tr>
            <td>Shipping</td>
            <td className="num">{formatCurrency(shipping)}</td>
          </tr>
          {tax > 0 ? (
            <tr>
              <td>Tax</td>
              <td className="num">{formatCurrency(tax)}</td>
            </tr>
          ) : null}
          <tr className="grand">
            <td>Total</td>
            <td className="num">{formatCurrency(total)}</td>
          </tr>
          <tr>
            <td>Paid</td>
            <td className="num">{formatCurrency(paid)}</td>
          </tr>
          {/* The number a courier acts on. Emphasised even when zero, so
              "nothing to collect" is stated rather than merely absent. */}
          <tr className="grand">
            <td>Amount due</td>
            <td className="num">{formatCurrency(due)}</td>
          </tr>
        </tbody>
      </table>

      {order.notes ? (
        <>
          <Rule />
          <div className="section">
            <div className="muted">Notes</div>
            <div>{order.notes}</div>
          </div>
        </>
      ) : null}

      <Rule />
      <div className="section muted" style={{ textAlign: 'center' }}>
        Thank you for your order.
      </div>
    </>
  )
}
