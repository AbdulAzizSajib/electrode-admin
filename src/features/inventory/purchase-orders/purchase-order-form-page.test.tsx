import { describe, expect, it, vi, beforeEach } from 'vitest'

// The default 5s is a scheduling artifact once the suite runs 13 workers in
// parallel; these render a full form and type into it.
vi.setConfig({ testTimeout: 15_000 })
import { render, screen, waitFor } from '@testing-library/react'
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
}))
vi.mock('@/lib/api/suppliers', () => ({
  useSuppliers: () => ({ data: { data: [{ id: 's-1', name: 'Anker BD', companyName: 'Anker Bangladesh Ltd' }] }, isLoading: false }),
}))
vi.mock('@/lib/api/products', () => ({
  useProducts: () => ({ data: { data: [{ id: 'p-1', name: 'Fast Charger' }] }, isFetching: false }),
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
})

describe('PurchaseOrderFormPage — a status this form never owned', () => {
  it('shows a received order its real status, read-only, and never writes one back', async () => {
    const user = userEvent.setup()
    stub.po = purchaseOrder('RECEIVED')
    render(<PurchaseOrderFormPage />)

    // Read-only: the merchant sees "Received", not a picker offering "Draft".
    expect(screen.getByText('Received')).toBeTruthy()
    expect(screen.queryByLabelText('Status')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0].input.status).toBeUndefined()
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
