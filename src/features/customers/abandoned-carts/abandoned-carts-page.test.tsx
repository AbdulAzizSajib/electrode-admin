import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbandonedCartsPage from '@/features/customers/abandoned-carts/abandoned-carts-page'
import { useSessionStore } from '@/lib/store/session-store'
import type { AbandonedCart } from '@/lib/api/abandoned-carts'

/**
 * Asserts `admin-abandoned-carts` — the screen lists and summarises abandoned
 * carts, offers contact for customers, and shows deleting and purging to
 * OWNER/ADMIN only, behind a confirmation.
 * See server/openspec/changes/add-abandoned-carts-admin.
 */

const CARTS: AbandonedCart[] = [
  {
    id: 'cart-customer',
    isGuest: false,
    customer: { name: 'Rahim Uddin', phone: '+8801711000000', email: 'rahim@example.test' },
    items: [
      {
        productId: 'p1',
        variantId: null,
        name: 'Power Bank',
        variantName: null,
        quantity: 2,
        unitPrice: 999,
        lineTotal: 1998,
      },
    ],
    itemCount: 2,
    total: 1998,
    lastActivityAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'cart-guest',
    isGuest: true,
    customer: null,
    items: [
      {
        productId: 'p2',
        variantId: 'v1',
        name: 'Smart Watch',
        variantName: 'Black',
        quantity: 1,
        unitPrice: 15000,
        lineTotal: 15000,
      },
    ],
    itemCount: 1,
    total: 15000,
    lastActivityAt: '2026-09-30T10:00:00.000Z',
  },
]

let carts: AbandonedCart[] = CARTS
const deleteCarts = vi.fn().mockResolvedValue({ deleted: 2 })

vi.mock('@/lib/api/abandoned-carts', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/abandoned-carts')>()),
  useAbandonedCarts: () => ({
    data: { data: carts, meta: { page: 1, limit: 20, total: carts.length, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAbandonedCartSummary: () => ({
    data: { total: carts.length, customer: 1, guest: 1, value: 16998 },
    isLoading: false,
  }),
  useDeleteCarts: () => ({ mutateAsync: deleteCarts, isPending: false }),
  usePurgeCarts: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const signInAs = (role: 'OWNER' | 'ADMIN' | 'STAFF') =>
  useSessionStore.setState({ user: { role } } as never)

beforeEach(() => {
  carts = CARTS
  deleteCarts.mockClear()
})

describe('AbandonedCartsPage', () => {
  it('shows the summary and one card per cart', () => {
    signInAs('STAFF')
    render(<AbandonedCartsPage />)

    expect(screen.getByText('Abandoned carts')).not.toBeNull()
    expect(screen.getByText('Rahim Uddin')).not.toBeNull()
    expect(screen.getByText('Guest')).not.toBeNull()
  })

  it("links a customer's phone for a call", () => {
    signInAs('STAFF')
    render(<AbandonedCartsPage />)

    const phone = screen.getByRole('link', { name: /\+8801711000000/ })
    expect(phone.getAttribute('href')).toBe('tel:+8801711000000')
  })

  it('says so when nothing is abandoned', () => {
    carts = []
    signInAs('STAFF')
    render(<AbandonedCartsPage />)

    expect(screen.getByText('No abandoned carts')).not.toBeNull()
  })

  it('shows staff no selection, delete or purge controls', () => {
    signInAs('STAFF')
    render(<AbandonedCartsPage />)

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Purge/ })).toBeNull()
  })

  it('lets an owner delete two selected carts after confirming', async () => {
    signInAs('OWNER')
    render(<AbandonedCartsPage />)

    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box)
    await userEvent.click(screen.getByRole('button', { name: /Delete selected/ }))

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteCarts).toHaveBeenCalledWith(['cart-customer', 'cart-guest'])
  })

  it('deletes nothing when the confirmation is cancelled', async () => {
    signInAs('ADMIN')
    render(<AbandonedCartsPage />)

    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(screen.getByRole('button', { name: /Delete selected/ }))

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(deleteCarts).not.toHaveBeenCalled()
  })
})
