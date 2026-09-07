import { describe, expect, it, vi, beforeEach } from 'vitest'

// The default 5s is a scheduling artifact once the suite runs many workers in
// parallel; these render a full table and drive a dialog.
vi.setConfig({ testTimeout: 15_000 })
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * The Stock page's job beyond listing quantities: making stock that cannot be
 * sold visible, and repairable, by the merchant who caused it.
 *
 * A `variantId: null` row is ordinary for a simple product and unsellable for a
 * variable one — orders deduct against the variant bought, so those units are
 * invisible to the storefront and the product reads out of stock however many
 * are on the shelf. Nothing errors, which is why the page has to say it.
 *
 * Everything under the page is stubbed. What is under test is the page's own
 * decisions: which rows it calls broken, and what it sends to fix them.
 */

const reassignMutate = vi.hoisted(() => vi.fn())
const adjustMutate = vi.hoisted(() => vi.fn())

/**
 * `p-var` has variants and `p-simple` does not, because that is the whole
 * distinction the page has to draw. The stock list deliberately cannot tell
 * them apart — the real `GET /stock` returns no variant list — so the page must
 * fetch each product to find out.
 */
const PRODUCT_DETAIL: Record<string, Record<string, unknown>> = {
  'p-var': {
    id: 'p-var',
    name: 'JBL Speaker',
    variants: [
      { id: 'v-black', name: 'Black', sku: 'jbl-black' },
      { id: 'v-navy', name: 'Navy', sku: 'jbl-navy' },
    ],
  },
  'p-simple': { id: 'p-simple', name: 'Fast Charger', variants: [] },
}

const stockRow = (over: Record<string, unknown>) => ({
  id: 'st-1',
  productId: 'p-var',
  variantId: null,
  warehouseId: 'w-1',
  quantity: 50,
  reservedQuantity: 0,
  available: 50,
  product: { id: 'p-var', name: 'JBL Speaker', sku: 'jbl' },
  variant: null,
  warehouse: { id: 'w-1', name: 'Merul Badda', code: 'MB' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
})

const stub = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))

vi.mock('@/lib/api/stock', () => ({
  useStock: () => ({
    data: { data: stub.rows, meta: { page: 1, limit: 10, total: stub.rows.length, totalPages: 1 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdjustStock: () => ({ mutateAsync: adjustMutate, isPending: false }),
  useReassignStockVariant: () => ({ mutateAsync: reassignMutate, isPending: false }),
}))
vi.mock('@/lib/api/warehouses', () => ({
  useWarehouses: () => ({ data: { data: [{ id: 'w-1', name: 'Merul Badda' }] } }),
}))
vi.mock('@/lib/api/products', () => ({
  useProducts: () => ({ data: { data: [{ id: 'p-var', name: 'JBL Speaker' }] } }),
  useProduct: (id?: string) => ({ data: id ? PRODUCT_DETAIL[id] : undefined, isFetching: false }),
}))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import StockPage from '@/features/inventory/stock/stock-page'

beforeEach(() => {
  stub.rows = [stockRow({})]
  reassignMutate.mockReset()
  adjustMutate.mockReset()
})

describe('StockPage — stock that cannot be sold', () => {
  it('flags a variable product’s variantless stock and says why it matters', async () => {
    render(<StockPage />)

    await waitFor(() => expect(screen.getByText('No variant')).toBeTruthy())
    // The banner connects the row to the symptom the merchant actually noticed.
    expect(screen.getByText('1 stock row cannot be sold')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Fix variant/ })).toBeTruthy()
  })

  it('leaves a simple product’s variantless stock alone', async () => {
    stub.rows = [
      stockRow({
        id: 'st-2',
        productId: 'p-simple',
        product: { id: 'p-simple', name: 'Fast Charger', sku: 'fc' },
      }),
    ]
    render(<StockPage />)

    // Nothing is wrong here: a product with no variants holds its stock exactly
    // this way, and calling it broken would be a false alarm on normal data.
    await waitFor(() => expect(screen.getByText('Fast Charger')).toBeTruthy())
    expect(screen.queryByText('No variant')).toBeNull()
    expect(screen.queryByRole('button', { name: /Fix variant/ })).toBeNull()
  })

  it('moves the stock onto the chosen variant', async () => {
    const user = userEvent.setup()
    render(<StockPage />)

    await user.click(await screen.findByRole('button', { name: /Fix variant/ }))

    await user.click(await screen.findByRole('combobox', { name: 'Correct variant' }))
    await user.click(await screen.findByRole('option', { name: 'Black' }))

    await user.click(screen.getByRole('button', { name: 'Move stock' }))

    await waitFor(() => expect(reassignMutate).toHaveBeenCalled())
    // Defaults to the whole unreserved quantity — the common case is a receipt
    // filed against no variant at all.
    expect(reassignMutate.mock.calls[0][0]).toMatchObject({
      id: 'st-1',
      variantId: 'v-black',
      quantity: 50,
    })
  })

  it('refuses to move anything until a variant is chosen', async () => {
    const user = userEvent.setup()
    render(<StockPage />)

    await user.click(await screen.findByRole('button', { name: /Fix variant/ }))
    await user.click(screen.getByRole('button', { name: 'Move stock' }))

    await waitFor(() => expect(screen.getByText('Choose the variant this stock belongs to.')).toBeTruthy())
    expect(reassignMutate).not.toHaveBeenCalled()
  })

  it('will not move units reserved against a placed order', async () => {
    const user = userEvent.setup()
    stub.rows = [stockRow({ reservedQuantity: 5, available: 45 })]
    render(<StockPage />)

    await user.click(await screen.findByRole('button', { name: /Fix variant/ }))
    await user.click(await screen.findByRole('combobox', { name: 'Correct variant' }))
    await user.click(await screen.findByRole('option', { name: 'Navy' }))

    // Defaulted to 45, not 50: the 5 reserved back an order already placed
    // against this row, and moving them would strand that order.
    const quantity = screen.getByLabelText('Quantity to move') as HTMLInputElement
    expect(quantity.value).toBe('45')

    await user.clear(quantity)
    await user.type(quantity, '50')
    await user.click(screen.getByRole('button', { name: 'Move stock' }))

    await waitFor(() => expect(screen.getByText('Enter a quantity between 1 and 45.')).toBeTruthy())
    expect(reassignMutate).not.toHaveBeenCalled()
  })
})
