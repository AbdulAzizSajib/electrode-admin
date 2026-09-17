/**
 * The rules that turn a raw selection into a print run.
 *
 * Pure and separate from `bulk-document-page.tsx` so they can be tested the way
 * the rest of this folder is tested — against fixtures, with no router and no
 * query client. What a batch contains is the part worth pinning: a run that
 * silently drops or duplicates an order is not something a passing render would
 * reveal.
 */
import type { Order } from '@/lib/api/orders'
import { BULK_PRINT_LIMIT } from './bulk-print-limit'

/**
 * Reads the `ids` query parameter.
 *
 * Defensive because this comes off a URL the operator can edit, truncate or
 * paste: blank segments from a trailing comma would otherwise become a query
 * for the order with an empty id, and a duplicated id would print the same
 * parcel's label twice.
 */
export function parseSelectionIds(raw: string | null): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return Array.from(new Set(parsed)).slice(0, BULK_PRINT_LIMIT)
}

/** A cancelled order has no parcel, so it gets no paper. */
export const isPrintable = (order: Order) => order.status !== 'CANCELLED'

export interface BatchComposition {
  /** Orders a document will be produced for, in selection order. */
  printable: Order[]
  /** Loaded but cancelled — reported on screen, never printed. */
  excluded: Order[]
  /** Selected ids that could not be loaded at all. */
  unreachable: number
}

/**
 * Splits what loaded into what prints and what is reported instead.
 *
 * `unreachable` is derived from the id count rather than from error objects, so
 * an order that fails for any reason — network, permission, deleted between
 * selection and print — is counted the same way and never silently vanishes
 * from the run.
 */
export function composeBatch(ids: string[], loaded: Order[]): BatchComposition {
  return {
    printable: loaded.filter(isPrintable),
    excluded: loaded.filter((order) => !isPrintable(order)),
    unreachable: ids.length - loaded.length,
  }
}
