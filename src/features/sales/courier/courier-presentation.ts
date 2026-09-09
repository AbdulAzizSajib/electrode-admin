/**
 * Shared presentation for courier state, so the orders list, the order detail
 * page and the dispatch result all describe the same thing the same way.
 */
import type { CourierIneligibleReason } from '@/lib/api/courier'

/**
 * How the courier's raw status reads to an operator.
 *
 * Keyed on the courier's own vocabulary rather than the panel's
 * `ShipmentStatus`, because that is what the backend stores verbatim and what
 * actually distinguishes the cases that matter — `delivered_approval_pending`
 * means the parcel arrived but the merchant has not been paid, which no
 * `ShipmentStatus` value can express.
 *
 * These keys are Steadfast's, the only integrated courier. A second courier
 * with a different vocabulary adds its own entries here; an unrecognised status
 * already falls through to a readable rendering of the raw string, so an
 * unmapped value degrades rather than breaking.
 */
const COURIER_STATUS_LABEL: Record<string, string> = {
  in_review: 'In review',
  pending: 'In transit',
  hold: 'On hold',
  delivered: 'Delivered',
  partial_delivered: 'Partly delivered',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
  delivered_approval_pending: 'Delivered — awaiting approval',
  partial_delivered_approval_pending: 'Partly delivered — awaiting approval',
  cancelled_approval_pending: 'Cancelled — awaiting approval',
  unknown_approval_pending: 'Unknown — contact courier',
}

export const courierStatusLabel = (raw: string | null | undefined): string =>
  raw ? (COURIER_STATUS_LABEL[raw] ?? raw) : '—'

/**
 * States that need a person.
 *
 * Mirrors the backend's own set. A cancellation means the parcel is coming back
 * and a partial delivery means some of it is — neither is something the panel
 * resolves on its own, and neither changes order status or stock automatically.
 */
export const courierNeedsAttention = (raw: string | null | undefined): boolean =>
  raw === 'cancelled' || raw === 'partial_delivered'

/** The server's refusal codes, said in words an operator can act on. */
export const INELIGIBLE_LABEL: Record<CourierIneligibleReason, string> = {
  NOT_PACKED: 'Not packed yet',
  ALREADY_DISPATCHED: 'Already with the courier',
  NO_SHIPPING_ADDRESS: 'No shipping address',
  NO_RECIPIENT_NAME: 'No recipient name',
  NAME_TOO_LONG: 'Recipient name too long',
  INVALID_PHONE: 'Phone the courier will not accept',
  ADDRESS_TOO_LONG: 'Address too long for the courier',
  /* The only reason here describing the SHOP rather than the order. Worded so
     an operator does not go looking for a fault in an order that has none. */
  PROVIDER_CANNOT_DISPATCH: 'This shop has no courier integration',
}
