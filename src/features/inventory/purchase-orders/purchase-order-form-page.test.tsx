import { describe, expect, it, vi, beforeEach } from 'vitest'

// The default 5s is a scheduling artifact once the suite runs 13 workers in
// parallel; these render a full form and type into it.
vi.setConfig({ testTimeout: 15_000 })
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * What the purchase-order authoring page promises, asserted against the real page.
 *
 * The first two are the ones that fail silently: a purchase order whose stock has
 * already been received has no status this form is allowed to set, and a record
 * that will not load must not offer a blank form whose save would overwrite it.
 * Both look like an ordinary successful save from the merchant's side.
 *
 * Everything under the page is stubbed — the API hooks, the router, the toast.
 * What is under test is the page's own decisions: what it sends, what it refuses
 * to send, and what it computes.
 */

interface Stub {
  po?: Record<string, unknown>
  loadingPo: boolean
  loadError?: unknown
}

const stub = vi.hoisted(() => ({ po: undefined, loadingPo: false, loadError: undefined }) as Stub)

const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const updateMutate = vi.hoisted(() => vi.fn())
const amendMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ poId: stub.po ? (stub.po.id as string) : undefined }),
  }
})

vi.mock('@/lib/api/purchase-orders', () => ({
  usePurchaseOrder: () => ({ data: stub.po, isLoading: stub.loadingPo, error: stub.loadError }),
  useCreatePurchaseOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdatePurchaseOrder: () => ({ mutateAsync: updateMutate, isPending: false }),
  useAmendPurchaseOrderItems: () => ({ mutateAsync: amendMutate, isPending: false }),
}))
vi.mock('@/lib/api/suppliers', () => ({
  useSuppliers: () => ({ data: { data: [{ id: 's-1', name: 'Anker BD', companyName: 'Anker Bangladesh Ltd' }] }, isLoading: false }),
}))
/*
 * `p-1` is simple and `p-2` is variable, because the two take different paths
 * through the line-item row: only the second gets a variant picker, and only the
 * second can fail to name one. The list rows deliberately carry no `variants`
 * key — the real `GET /products/admin` omits it, which is exactly why the row
 * has to fetch the detail below.
 */
const PRODUCT_DETAIL: Record<string, Record<string, unknown>> = {
  'p-1': { id: 'p-1', name: 'Fast Charger', variants: [] },
  'p-2': {
    id: 'p-2',
    name: 'Q86 Retro',
    variants: [
      { id: 'v-red', name: 'Red', sku: 'q86-red' },
      { id: 'v-white', name: 'White', sku: 'q86-white' },
    ],
  },
}

vi.mock('@/lib/api/products', () => ({
  useProducts: () => ({
    data: { data: [{ id: 'p-1', name: 'Fast Charger' }, { id: 'p-2', name: 'Q86 Retro' }] },
    isFetching: false,
  }),
  useProduct: (id?: string) => ({ data: id ? PRODUCT_DETAIL[id] : undefined, isFetching: false }),
}))
vi.mock('@/components/layout/breadcrumb-context', () => ({ useBreadcrumbLabel: () => {} }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import PurchaseOrderFormPage from '@/features/inventory/purchase-orders/purchase-order-form-page'
import { formatCurrency } from '@/lib/utils/format'

const purchaseOrder = (status: string) => ({
  id: 'po-1',
  purchaseNumber: 'PO-0001',
  supplierId: 's-1',
  supplier: { id: 's-1', name: 'Anker BD', companyName: 'Anker Bangladesh Ltd' },
  status,
  items: [
    {
      id: 'li-1',
      productId: 'p-1',
      product: { id: 'p-1', name: 'Fast Charger', sku: 'fast-charger' },
      quantity: 4,
      receivedQuantity: 4,
      unitCost: '250',
      totalCost: '1000',
    },
  ],
  subtotal: '1000',
  shippingCost: '40',
  taxAmount: '10',
  totalAmount: '1050',
  notes: 'Rush',
  orderedAt: null,
  receivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

beforeEach(() => {
  stub.po = undefined
  stub.loadingPo = false
  stub.loadError = undefined
  navigate.mockReset()
  createMutate.mockReset()
  updateMutate.mockReset()
  amendMutate.mockReset()
})

describe('PurchaseOrderFormPage — a status this form never owned', () => {
  it('shows a received order its real status, read-only, and never writes one back', async () => {
    const user = userEvent.setup()
    stub.po = purchaseOrder('RECEIVED')
    render(<PurchaseOrderFormPage />)

    // Read-only: the merchant sees "Received", not a picker offering "Draft".
    // Scoped to the status field — the line-items table now has a "Received"
    // column header too, which is a different thing with the same word.
    const statusField = screen.getByText('Status').parentElement as HTMLElement
    expect(within(statusField).getByText('Received')).toBeTruthy()
    expect(screen.queryByLabelText('Status')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())

    /*
     * Nothing is sent to the scalar endpoint at all. It refuses every edit once
     * receiving has begun, so a request would fail the save outright — and the
     * status this form never owned is exactly what such a request would carry.
     * Line items remain amendable via their own endpoint (below), which is the
     * point of the split.
     */
    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('still amends line items on a received order, through their own endpoint', async () => {
    const user = userEvent.setup()
    stub.po = purchaseOrder('RECEIVED')
    render(<PurchaseOrderFormPage />)

    // 4 of 4 already received, so 6 is a legal amendment and 3 would not be.
    const quantity = screen.getByLabelText('Quantity for Fast Charger')
    await user.clear(quantity)
    await user.type(quantity, '6')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(amendMutate).toHaveBeenCalled())
    expect(amendMutate.mock.calls[0][0].input.items[0]).toMatchObject({
      id: 'li-1',
      productId: 'p-1',
      quantity: 6,
    })
  })

  it('will not offer to remove a line that has already received stock', () => {
    stub.po = purchaseOrder('RECEIVED')
    render(<PurchaseOrderFormPage />)

    // Removing it would strand a receipt that moved real stock and set a cost basis.
    const remove = screen.getByRole('button', { name: 'Remove Fast Charger' }) as HTMLButtonElement
    expect(remove.disabled).toBe(true)
  })

  it('still sends the status of an order that has one to set', async () => {
    const user = userEvent.setup()
    stub.po = purchaseOrder('ORDERED')
    render(<PurchaseOrderFormPage />)

    expect(screen.getByLabelText('Status')).toBeTruthy()
    // The status the record arrived with is the one the field holds — Radix's
    // hidden native select must not have mirrored an empty value back over it.
    expect((document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement).value).toBe('ORDERED')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0].input.status).toBe('ORDERED')
  })
})

describe('PurchaseOrderFormPage — a record that will not load', () => {
  it('offers no form to save over it', () => {
    stub.po = purchaseOrder('DRAFT')
    stub.loadError = new Error('Network request failed')
    render(<PurchaseOrderFormPage />)

    expect(screen.getByText('This purchase order could not be opened')).toBeTruthy()
    expect(screen.getByText('Network request failed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })
})

/**
 * The bug this covers is silent end to end. Stock is held per (warehouse,
 * product, variant) and a customer order deducts against the variant bought, so
 * a line that names no variant receives its units onto a `variantId: null` row
 * no order can match — the merchant receives 50, the save succeeds, and the
 * storefront goes on showing the product as out of stock with nothing anywhere
 * reporting a problem.
 */
describe('PurchaseOrderFormPage — which variant the stock is for', () => {
  /** Picks `label` in the combobox named `name`. */
  const choose = async (user: ReturnType<typeof userEvent.setup>, name: string, label: string) => {
    await user.click(screen.getByRole('combobox', { name }))
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())
    await user.click(screen.getByRole('option', { name: label }))
  }

  it('sends the chosen variant, so the stock lands where orders look for it', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await choose(user, 'Supplier', 'Anker BD')
    await choose(user, 'Product for line 1', 'Q86 Retro')
    await choose(user, 'Variant for Q86 Retro', 'White')

    await user.clear(screen.getByLabelText('Quantity for Q86 Retro'))
    await user.type(screen.getByLabelText('Quantity for Q86 Retro'), '50')

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].items[0]).toMatchObject({
      productId: 'p-2',
      variantId: 'v-white',
      quantity: 50,
    })
  })

  it('refuses to save a variable product line that names no variant', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await choose(user, 'Supplier', 'Anker BD')
    await choose(user, 'Product for line 1', 'Q86 Retro')
    // Variant deliberately left unchosen.

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(screen.getByText('Choose which variant this line is for')).toBeTruthy())
    // The point of the guard: nothing was sent.
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('leaves a simple product alone — no picker, and no variantId sent', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await choose(user, 'Supplier', 'Anker BD')
    await choose(user, 'Product for line 1', 'Fast Charger')

    await waitFor(() => expect(screen.getByText('No variants')).toBeTruthy())
    expect(screen.queryByRole('combobox', { name: 'Variant for Fast Charger' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    // Absent, not an empty string — the backend distinguishes the two.
    expect(createMutate.mock.calls[0][0].items[0].variantId).toBeUndefined()
  })

  it('drops a variant already chosen when the row switches product', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await choose(user, 'Supplier', 'Anker BD')
    await choose(user, 'Product for line 1', 'Q86 Retro')
    await choose(user, 'Variant for Q86 Retro', 'Red')

    // Carried over, "v-red" would be submitted against a product that does not
    // own it — which the backend rejects outright.
    await choose(user, 'Product for Q86 Retro', 'Fast Charger')

    await waitFor(() => expect(screen.getByText('No variants')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].items[0]).toMatchObject({ productId: 'p-1' })
    expect(createMutate.mock.calls[0][0].items[0].variantId).toBeUndefined()
  })
})

describe('PurchaseOrderFormPage — what the money adds up to', () => {
  it('shows each line and every figure that moves the total', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await user.clear(screen.getByLabelText('Quantity for line 1'))
    await user.type(screen.getByLabelText('Quantity for line 1'), '3')
    await user.clear(screen.getByLabelText('Unit cost for line 1'))
    await user.type(screen.getByLabelText('Unit cost for line 1'), '100')
    await user.type(screen.getByLabelText('Shipping cost'), '50')
    await user.type(screen.getByLabelText('Tax amount'), '20')

    // The line's own amount, then the four-line breakdown the detail page shows.
    await waitFor(() => expect(screen.getByText(formatCurrency(300))).toBeTruthy())
    expect(screen.getByText(`Subtotal: ${formatCurrency(300)}`)).toBeTruthy()
    expect(screen.getByText(`Shipping: ${formatCurrency(50)}`)).toBeTruthy()
    expect(screen.getByText(`Tax: ${formatCurrency(20)}`)).toBeTruthy()
    expect(screen.getByText(`Total: ${formatCurrency(370)}`)).toBeTruthy()
  })
})
