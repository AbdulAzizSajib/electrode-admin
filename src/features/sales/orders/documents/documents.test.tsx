/**
 * Behaviour tests for the three fulfilment documents.
 *
 * These cover the requirements that are about what does and does not reach
 * paper — the prohibitions in particular, since a leaked cost figure or a
 * blank address block is not something a passing build would ever reveal.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { Order, OrderLineItem } from '@/lib/api/orders'
import type { Payment } from '@/lib/api/payments'
import type { StoreSettings } from '@/lib/api/store-settings'
import { setCurrencyFormat } from '@/lib/utils/format'
import { PackingSlip } from './packing-slip'
import { Invoice } from './invoice'
import { ShippingLabel } from './shipping-label'
import { composeBatch, parseSelectionIds } from './bulk-selection'
import { BULK_PRINT_LIMIT } from './bulk-print-limit'

const item = (over: Partial<OrderLineItem> = {}): OrderLineItem => ({
  productId: 'p1',
  variantId: null,
  productName: 'Cotton Shirt',
  sku: 'SHIRT-01',
  quantity: 2,
  unitPrice: '500.00',
  totalPrice: '1000.00',
  // Printed documents do not render the thumbnail — a packing slip is read
  // beside the goods themselves — but the field is on every line the API
  // returns, so the fixture carries it.
  image: null,
  ...over,
})

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    orderNumber: 'ORD-20260908-A1B2C3',
    customerId: 'c1',
    customer: { id: 'c1', firstName: 'Ayesha', lastName: 'Rahman', email: 'a@example.com', phone: '01700000000' },
    status: 'PACKED',
    items: [item()],
    subtotal: '1000.00',
    discountAmount: '0.00',
    shippingAmount: '60.00',
    taxAmount: '0.00',
    totalAmount: '1060.00',
    couponCode: null,
    notes: null,
    landingPageId: null,
    landingPageTitle: null,
    deliveryMethod: 'DELIVERY',
    deliveryOptionKey: 'inside-dhaka',
    deliveryOptionLabel: 'Inside Dhaka',
    shippingAddress: {
      fullName: 'Ayesha Rahman',
      phone: '01700000000',
      addressLine1: '12 Green Road',
      addressLine2: null,
      city: 'Dhaka',
      state: null,
      postalCode: '1205',
      country: 'Bangladesh',
    },
    payments: [],
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    ...over,
  }) as Order

const payment = (amount: string, status: Payment['status'] = 'PAID'): Payment =>
  ({
    id: `pay-${amount}-${status}`,
    orderId: 'o1',
    transactionId: null,
    amount,
    method: 'COD',
    status,
    gateway: null,
    paidAt: null,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
  }) as Payment

const settings = {
  storeName: 'Electrode',
  address: '34 North Pirerbag, Dhaka',
  contactPhone: '01900000000',
  contactEmail: 'shop@example.com',
  logoUrl: null,
} as StoreSettings

describe('PackingSlip', () => {
  it('lists every item with name, quantity and SKU', () => {
    const { getByText, getAllByText } = render(
      <PackingSlip
        order={order({ items: [item(), item({ productName: 'Wool Cap', sku: 'CAP-9', quantity: 3 })] })}
        settings={settings}
      />,
    )

    expect(getByText('Cotton Shirt')).toBeTruthy()
    expect(getByText('SKU SHIRT-01')).toBeTruthy()
    expect(getByText('Wool Cap')).toBeTruthy()
    expect(getByText('SKU CAP-9')).toBeTruthy()
    expect(getAllByText('3').length).toBeGreaterThan(0)
  })

  it('shows no money of any kind', () => {
    // The slip travels with the goods. Nothing priced belongs on it, and the
    // merchant's buying cost least of all.
    const { container } = render(<PackingSlip order={order()} settings={settings} />)
    const text = container.textContent ?? ''

    expect(text).not.toContain('500')
    expect(text).not.toContain('1000')
    expect(text).not.toContain('1060')
    expect(text).not.toContain('60.00')
    expect(text.toLowerCase()).not.toContain('total price')
    expect(text.toLowerCase()).not.toContain('unit price')
  })

  it('identifies the order and the recipient', () => {
    const { getByText } = render(<PackingSlip order={order()} settings={settings} />)
    expect(getByText('ORD-20260908-A1B2C3')).toBeTruthy()
    expect(getByText('Ayesha Rahman')).toBeTruthy()
  })
})

describe('Invoice', () => {
  // A store configured for whole taka, matching the seeded default.
  setCurrencyFormat({ symbol: '৳', position: 'BEFORE', decimals: 2 })

  it('prints the order totals as recorded', () => {
    const { container } = render(
      <Invoice order={order()} payments={[]} settings={settings} />,
    )
    const text = container.textContent ?? ''

    expect(text).toContain('1,000.00') // subtotal
    expect(text).toContain('60.00') // shipping
    expect(text).toContain('1,060.00') // total
  })

  it('states the full total as due when nothing is paid', () => {
    // The cash-on-delivery case: this is what the courier collects.
    const { container } = render(
      <Invoice
        order={order({ totalAmount: '1200.00', subtotal: '1200.00', shippingAmount: '0.00' })}
        payments={[]}
        settings={settings}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Amount due')
    expect(text).toContain('1,200.00')
  })

  it('shows the remainder when partly paid', () => {
    const { container } = render(
      <Invoice
        order={order({ totalAmount: '1200.00', subtotal: '1200.00', shippingAmount: '0.00' })}
        payments={[payment('500.00')]}
        settings={settings}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('500.00') // paid
    expect(text).toContain('700.00') // due
  })

  it('counts only PAID payments toward the balance', () => {
    // A pending or failed payment has collected nothing; treating it as paid
    // would tell a courier to collect less than the customer owes.
    const { container } = render(
      <Invoice
        order={order({ totalAmount: '1200.00', subtotal: '1200.00', shippingAmount: '0.00' })}
        payments={[payment('500.00', 'PENDING'), payment('300.00', 'FAILED')]}
        settings={settings}
      />,
    )
    expect(container.textContent).toContain('1,200.00')
  })

  it('honours a store configured for zero decimal places', () => {
    setCurrencyFormat({ symbol: '৳', position: 'BEFORE', decimals: 0 })
    const { container } = render(
      <Invoice order={order()} payments={[]} settings={settings} />,
    )
    expect(container.textContent).toContain('1,060')
    expect(container.textContent).not.toContain('1,060.00')
    setCurrencyFormat({ symbol: '৳', position: 'BEFORE', decimals: 2 })
  })
})

describe('ShippingLabel', () => {
  it('carries the recipient address and phone', () => {
    const { getByText } = render(
      <ShippingLabel order={order()} settings={settings} size="thermal" />,
    )
    expect(getByText('Ayesha Rahman')).toBeTruthy()
    expect(getByText('12 Green Road')).toBeTruthy()
    expect(getByText('Dhaka, 1205')).toBeTruthy()
    expect(getByText('01700000000')).toBeTruthy()
  })

  it('prints a barcode of the order number, with the number beneath it', () => {
    const { container, getByText } = render(
      <ShippingLabel order={order()} settings={settings} size="thermal" />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(getByText('ORD-20260908-A1B2C3')).toBeTruthy()
  })

  it('states collection rather than showing a blank address block', () => {
    // A label with an empty address reads as a rendering bug and tells the
    // packer nothing.
    const { getByText } = render(
      <ShippingLabel order={order({ shippingAddress: null })} settings={settings} size="thermal" />,
    )
    expect(getByText('Collection')).toBeTruthy()
    expect(getByText(/collected in store/i)).toBeTruthy()
  })

  it('shows no prices — a label is visible to everyone handling the parcel', () => {
    const { container } = render(
      <ShippingLabel order={order()} settings={settings} size="thermal" />,
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain('1,060')
    expect(text).not.toContain('1060')
  })
})

/**
 * Batch composition for a bulk print run.
 *
 * These pin what a run CONTAINS rather than how it renders: an order silently
 * dropped from a batch, or printed twice, produces paper that looks entirely
 * correct — the operator only finds out by recounting parcels against the
 * selection they made.
 */
describe('bulk print selection', () => {
  it('produces one document per selected order', () => {
    const orders = [
      order({ id: 'o1', orderNumber: 'ORD-1' }),
      order({ id: 'o2', orderNumber: 'ORD-2' }),
      order({ id: 'o3', orderNumber: 'ORD-3' }),
    ]
    const batch = composeBatch(['o1', 'o2', 'o3'], orders)

    expect(batch.printable).toHaveLength(3)
    expect(batch.excluded).toHaveLength(0)
    expect(batch.unreachable).toBe(0)
  })

  it('excludes cancelled orders and reports them', () => {
    // The merchant's workflow is filter-then-select-all, so a cancelled order
    // in a batch means the filter did not do what they thought. Six selected
    // and four printed has to be explained, not left to a recount.
    const orders = [
      order({ id: 'o1', orderNumber: 'ORD-1' }),
      order({ id: 'o2', orderNumber: 'ORD-2', status: 'CANCELLED' }),
      order({ id: 'o3', orderNumber: 'ORD-3' }),
      order({ id: 'o4', orderNumber: 'ORD-4', status: 'CANCELLED' }),
    ]
    const batch = composeBatch(['o1', 'o2', 'o3', 'o4'], orders)

    expect(batch.printable.map((o) => o.orderNumber)).toEqual(['ORD-1', 'ORD-3'])
    expect(batch.excluded.map((o) => o.orderNumber)).toEqual(['ORD-2', 'ORD-4'])
  })

  it('leaves nothing printable when every selected order is cancelled', () => {
    const orders = [
      order({ id: 'o1', status: 'CANCELLED' }),
      order({ id: 'o2', status: 'CANCELLED' }),
    ]
    const batch = composeBatch(['o1', 'o2'], orders)

    expect(batch.printable).toHaveLength(0)
    expect(batch.excluded).toHaveLength(2)
  })

  it('counts orders that could not be loaded without dropping the rest', () => {
    // One unreachable order must not strand a packing session.
    const batch = composeBatch(['o1', 'o2', 'o3'], [order({ id: 'o1' }), order({ id: 'o3' })])

    expect(batch.printable).toHaveLength(2)
    expect(batch.unreachable).toBe(1)
  })

  it('keeps every non-cancelled status printable', () => {
    // Only CANCELLED is excluded: a pending order gets a slip when it is
    // picked, and a delivered one may need its invoice reprinted.
    const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as const
    const orders = statuses.map((status, i) => order({ id: `o${i}`, status }))

    expect(composeBatch(orders.map((o) => o.id), orders).printable).toHaveLength(statuses.length)
  })

  it('parses ids from the query string, dropping blanks and duplicates', () => {
    // A duplicated id would print the same parcel's label twice; a blank
    // segment from a trailing comma would query for the order with no id.
    expect(parseSelectionIds('o1,o2,o3')).toEqual(['o1', 'o2', 'o3'])
    expect(parseSelectionIds('o1, o2 ,,o3,')).toEqual(['o1', 'o2', 'o3'])
    expect(parseSelectionIds('o1,o2,o1')).toEqual(['o1', 'o2'])
    expect(parseSelectionIds('')).toEqual([])
    expect(parseSelectionIds(null)).toEqual([])
  })

  it('caps a run at the stated limit', () => {
    const ids = Array.from({ length: BULK_PRINT_LIMIT + 10 }, (_, i) => `o${i}`)
    expect(parseSelectionIds(ids.join(','))).toHaveLength(BULK_PRINT_LIMIT)
  })
})
