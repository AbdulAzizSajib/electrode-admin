import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { useSessionStore } from '@/lib/store/session-store'
import { useUiStore } from '@/lib/store/ui-store'

/**
 * Asserts `admin-shell` — "A bottom navigation bar on narrow screens" and "New
 * orders are visible from the bottom bar".
 * See server/openspec/changes/add-admin-mobile-shell.
 */

let pendingOrderCount = 0
vi.mock('@/lib/realtime/use-realtime', () => ({
  usePulseValue: () => ({ pendingOrderCount }),
}))

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <MobileBottomNav />
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Quick navigation' })
const current = () =>
  within(nav())
    .queryAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)

beforeEach(() => {
  pendingOrderCount = 0
  useSessionStore.setState({ user: { role: 'STAFF' } } as never)
  useUiStore.setState({ mobileNavOpen: false })
})

describe('MobileBottomNav', () => {
  it('offers Home, Orders, Products, Inventory and More, in that order', () => {
    renderAt('/dashboard')

    const labels = within(nav())
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(labels).toEqual(['Home', 'Orders', 'Products', 'Inventory', 'More'])
  })

  it('shows the pending-orders count on Orders', () => {
    pendingOrderCount = 4
    renderAt('/dashboard')

    expect(within(nav()).getByRole('link', { name: /Orders/ }).textContent).toContain('4')
  })

  it('shows no count when nothing is pending', () => {
    renderAt('/dashboard')

    expect(within(nav()).getByRole('link', { name: /Orders/ }).textContent).toBe('Orders')
  })

  it('caps the count at 99+', () => {
    pendingOrderCount = 250
    renderAt('/dashboard')

    expect(within(nav()).getByRole('link', { name: /Orders/ }).textContent).toContain('99+')
  })

  it('marks Inventory current on a screen listed under it, though its route is under /sales', () => {
    renderAt('/sales/returns')

    expect(current()).toEqual(['Inventory'])
  })

  it('marks Orders current on an order detail page', () => {
    renderAt('/sales/orders/abc')

    expect(current()).toEqual(['Orders'])
  })

  it('marks More current on a screen none of the four covers', () => {
    renderAt('/seo/general')

    expect(current()).toEqual([])
    expect(within(nav()).getByRole('button', { name: 'More' }).className).toContain('text-primary')
  })

  it('opens the full menu drawer from More', async () => {
    renderAt('/dashboard')

    await userEvent.click(within(nav()).getByRole('button', { name: 'More' }))

    expect(useUiStore.getState().mobileNavOpen).toBe(true)
  })
})
