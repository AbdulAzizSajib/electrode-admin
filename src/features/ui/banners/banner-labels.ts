import type { BannerPlacement } from '@/lib/api/banners'

/**
 * How a placement reads to a merchant. Its own module so the list page and the
 * form page can share it — a non-component export alongside a component breaks
 * fast refresh, which is why `bundle-deal-labels.ts` is split out the same way.
 */
export const PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  HEADER: 'Header',
  MID: 'Mid page',
  FOOTER: 'Footer',
  SIDEBAR: 'Sidebar',
  POPUP: 'Popup',
  HERO_SLIDER: 'Hero slider',
  HERO_SIDE: 'Hero side',
  HERO_PROMO: 'Hero promo',
}
