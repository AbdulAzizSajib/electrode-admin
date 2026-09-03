import type { ShippingPlace } from '@/lib/api/shipping-rules'

/**
 * What a place covers, said the way a merchant would say it.
 *
 * `country`/`state` null means "anywhere", so a place with neither is the
 * catch-all — "Everywhere else" rather than a blank cell, since a blank reads
 * as missing data instead of as the fallback it is.
 *
 * Lives apart from the pages so both the list and the form say it the same way,
 * and so neither page file exports a non-component.
 */
export function destinationLabel(place: Pick<ShippingPlace, 'country' | 'state'>) {
  if (place.state && place.country) return `${place.state}, ${place.country}`
  if (place.country) return `All of ${place.country}`
  return 'Everywhere else'
}

export const SHIPPING_RULES_PATH = '/catalog/shipping-rules'
