import { describe, expect, it } from 'vitest'
import { NAV_SECTIONS } from '@/routes/nav-config'

/**
 * What the sidebar's shape has to keep true.
 *
 * These are cheap invariants that no page test would catch, and two of them
 * were live risks when Returns, Refunds and Courier moved out of a "Sales"
 * section and into Inventory while KEEPING their /sales/* routes. A path and
 * the menu it hangs under are now deliberately unrelated, so the things that
 * used to hold by construction have to be asserted.
 */
describe('NAV_SECTIONS', () => {
  const sections = NAV_SECTIONS
  const allItems = sections.flatMap((s) => (s.items ?? []).map((i) => ({ section: s.label, ...i })))

  it('has no Sales section left, and lost none of its pages', () => {
    expect(sections.find((s) => s.label === 'Sales')).toBeUndefined()

    // The three that section held are still reachable, under Inventory.
    const inventory = sections.find((s) => s.label === 'Inventory')
    const paths = inventory?.items?.map((i) => i.path) ?? []
    expect(paths).toContain('/sales/returns')
    expect(paths).toContain('/sales/refunds')
    expect(paths).toContain('/sales/courier')
  })

  /*
   * The move was a REGROUPING, not a re-route: the pages keep their /sales/*
   * paths so bookmarks and the router are untouched. Renaming a path here
   * without moving the route would 404 the menu entry silently.
   */
  it('keeps the moved pages on their original routes', () => {
    const inventory = sections.find((s) => s.label === 'Inventory')
    expect(inventory?.items?.find((i) => i.label === 'Returns')?.path).toBe('/sales/returns')
    expect(inventory?.items?.find((i) => i.label === 'Refunds')?.path).toBe('/sales/refunds')
    expect(inventory?.items?.find((i) => i.label === 'Courier')?.path).toBe('/sales/courier')
  })

  /*
   * Breadcrumbs resolve a section by testing direct links first, then matching
   * an item path as a PREFIX of the current pathname. Orders is a direct link
   * at /sales/orders, and three Inventory items now share the /sales prefix —
   * so an item path must never be a prefix of Orders' path, or an order detail
   * page would resolve to the wrong section.
   */
  it('has no item path that would swallow the Orders route', () => {
    const orders = sections.find((s) => s.label === 'Orders')?.path
    expect(orders).toBe('/sales/orders')

    for (const item of allItems) {
      expect(
        orders!.startsWith(item.path),
        `${item.section} › ${item.label} (${item.path}) is a prefix of ${orders}`,
      ).toBe(false)
    }
  })

  /** One path, one menu entry: a duplicate makes two sidebar rows light up at once. */
  it('lists no path twice', () => {
    const paths = [
      ...sections.filter((s) => s.path).map((s) => s.path!),
      ...allItems.map((i) => i.path),
    ]
    expect(paths).toHaveLength(new Set(paths).size)
  })
})
