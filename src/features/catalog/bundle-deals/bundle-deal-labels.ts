import type { BundleDeal } from '@/lib/api/bundle-deals'

/**
 * The offer as a merchant would say it out loud.
 *
 * Lives beside the pages rather than inside one so both the list and the form
 * read the offer the same way — and so neither page file exports something that
 * is not a component, which would cost it fast refresh.
 */
export function offerLabel(deal: Pick<BundleDeal, 'buyQuantity' | 'freeQuantity'>) {
  return `Buy ${deal.buyQuantity}, get ${deal.freeQuantity} free`
}

export const BUNDLE_DEALS_PATH = '/catalog/bundle-deals'
