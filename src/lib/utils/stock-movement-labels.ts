/**
 * Movement type labels and badge variants, shared by the two pages that read
 * `StockMovement`: Inventory → Stock Movements (the operational audit feed) and
 * Report → Stock history (the periodic opening-to-closing view).
 *
 * Lifted out of `stock-movements-page.tsx` when the second reader appeared.
 * Two private copies would drift, and a merchant seeing "Transfer in" on one
 * page and "TRANSFER_IN" on the other has no way to know they are the same
 * thing.
 */
export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'CANCELLATION'

export const STOCK_MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  RETURN: 'Return',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  DAMAGE: 'Damage',
  LOSS: 'Loss',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  // Names the cause, not the mechanism: the merchant is looking for why stock
  // came back, and "cancelled order" is the answer they are checking against.
  CANCELLATION: 'Order cancelled',
}

export type StockMovementBadgeVariant =
  | 'success'
  | 'warning'
  | 'info'
  | 'secondary'
  | 'destructive'

export const STOCK_MOVEMENT_TYPE_VARIANT: Record<StockMovementType, StockMovementBadgeVariant> = {
  PURCHASE: 'success',
  SALE: 'secondary',
  RETURN: 'info',
  REFUND: 'info',
  ADJUSTMENT: 'warning',
  DAMAGE: 'destructive',
  LOSS: 'destructive',
  TRANSFER_IN: 'success',
  TRANSFER_OUT: 'warning',
  // Info, not success: stock coming back is neutral news, unlike a delivery.
  CANCELLATION: 'info',
}

export const STOCK_MOVEMENT_TYPES = Object.keys(STOCK_MOVEMENT_TYPE_LABEL) as StockMovementType[]

/** Falls back to the raw value rather than rendering blank if the backend adds a type before the admin knows about it. */
export function stockMovementLabel(type: string): string {
  return STOCK_MOVEMENT_TYPE_LABEL[type as StockMovementType] ?? type
}

export function stockMovementVariant(type: string): StockMovementBadgeVariant {
  return STOCK_MOVEMENT_TYPE_VARIANT[type as StockMovementType] ?? 'secondary'
}
