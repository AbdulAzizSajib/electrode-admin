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
  /*
   * The three prices matter to the pricing panel below: `p-1` has a full set,
   * `p-3` has no cost basis at all (the seed must leave the field alone), and
   * `p-2`'s variants override some prices and inherit others — which is the
   * per-field precedence the panel has to get right.
   */
  'p-1': {
    id: 'p-1',
    name: 'Fast Charger',
    variants: [],
    purchasePrice: 90,
    offerPrice: 150,
    sellingPrice: 180,
  },
  'p-2': {
    id: 'p-2',
    name: 'Q86 Retro',
    purchasePrice: 88,
    offerPrice: 150,
    sellingPrice: 175,
    variants: [
      { id: 'v-red', name: 'Red', sku: 'q86-red', purchasePrice: 120, offerPrice: 200 },
      { id: 'v-white', name: 'White', sku: 'q86-white' },
    ],
  },
  'p-3': { id: 'p-3', name: 'No Cost Item', variants: [], offerPrice: 150, sellingPrice: 180 },
}

vi.mock('@/lib/api/products', () => ({
  useProducts: () => ({
    data: {
      data: [
        { id: 'p-1', name: 'Fast Charger' },
        { id: 'p-2', name: 'Q86 Retro' },
        { id: 'p-3', name: 'No Cost Item' },
      ],
    },
    isFetching: false,
  }),
  useProduct: (id?: string) => ({ data: id ? PRODUCT_DETAIL[id] : undefined, isFetching: false }),
}))
vi.mock('@/components/layout/breadcrumb-context', () => ({ useBreadcrumbLabel: () => {} }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import PurchaseOrderFormPage from '@/features/inventory/purchase-orders/purchase-order-form-page'
import { formatCurrency } from '@/lib/utils/format'

/**
 * Adds a product through the search bar — the only way to put a line on an
 * order now. A variable product leaves the variant dialog open for the caller.
 */
const addViaSearch = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('combobox', { name: 'Search products to add to this order' }))
  await waitFor(() => expect(screen.getByRole('listbox')).not.toBeNull())
  await user.click(screen.getByRole('option', { name: label }))
}

const chooseSupplier = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox', { name: 'Supplier' }))
  await user.click(await screen.findByRole('option', { name: /Anker BD/ }))
}

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
  it('sends the chosen variant, so the stock lands where orders look for it', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    // A variable product opens the dialog instead of adding a line outright.
    await addViaSearch(user, 'Q86 Retro')
    await user.click(await screen.findByRole('option', { name: /White/ }))

    const qty = await screen.findByLabelText('Quantity for Q86 Retro')
    await user.clear(qty)
    await user.type(qty, '50')

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].items[0]).toMatchObject({
      productId: 'p-2',
      variantId: 'v-white',
      quantity: 50,
    })
  })

  /*
   * The old form let a variable product's line sit on the table naming no
   * variant, and caught it at save. The dialog makes that state unreachable:
   * dismissing it adds nothing at all, so there is no invalid line to refuse.
   * Asserted as "no line was created" rather than "the save was refused",
   * because the guard moved earlier rather than away.
   */
  it('adds no line at all when the variant dialog is dismissed', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Q86 Retro')
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The blank opening row is still blank — nothing was put on the order.
    expect(screen.getByLabelText('Quantity for line 1')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))
    expect(createMutate).not.toHaveBeenCalled()
  })

  /*
   * REGRESSION. The dialog first shipped as a list of <button>s, which answer
   * arrow keys by doing nothing — the merchant's report was "modal ase thik ee
   * but keyboard diye up/down arrow diye select korte pari na".
   *
   * The fix is the contract the Combobox in this kit already implements: a
   * listbox whose highlight is state, published through `aria-activedescendant`,
   * with the options NOT focusable. Pinned here because it is invisible to a
   * mouse-only test — every click-driven assertion above passed while the
   * keyboard did nothing at all.
   */
  it('moves through variants with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Q86 Retro')

    const list = await screen.findByRole('listbox', { name: /Variants of Q86 Retro/i })
    // Opens on the first variant, so Enter alone is never a surprise.
    expect(within(list).getByRole('option', { name: /Red/ }).getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{ArrowDown}')
    expect(within(list).getByRole('option', { name: /White/ }).getAttribute('aria-selected')).toBe('true')

    // Wraps, rather than stopping dead at the end of a two-item list.
    await user.keyboard('{ArrowDown}')
    expect(within(list).getByRole('option', { name: /Red/ }).getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{ArrowUp}')
    expect(within(list).getByRole('option', { name: /White/ }).getAttribute('aria-selected')).toBe('true')

    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].items[0]).toMatchObject({
      productId: 'p-2',
      variantId: 'v-white',
    })
  })

  it('leaves a simple product alone — no dialog, and no variantId sent', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Fast Charger')

    // Added straight away: there is nothing to choose between.
    await waitFor(() => expect(screen.getByText('No variants')).toBeTruthy())
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    // Absent, not an empty string — the backend distinguishes the two.
    expect(createMutate.mock.calls[0][0].items[0].variantId).toBeUndefined()
  })

  /*
   * Two variants of one product are two items — stock is held per (warehouse,
   * product, variant) — so each gets its own line. Merging them would order the
   * right total of the wrong thing.
   */
  it('gives a second variant of the same product its own line', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Q86 Retro')
    await user.click(await screen.findByRole('option', { name: /Red/ }))

    await addViaSearch(user, 'Q86 Retro')
    await user.click(await screen.findByRole('option', { name: /White/ }))

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const { items } = createMutate.mock.calls[0][0]
    expect(items).toHaveLength(2)
    expect(items.map((i: { variantId?: string }) => i.variantId)).toEqual(['v-red', 'v-white'])
  })

  /*
   * The same item picked twice is "one more of those". A second line would
   * leave the merchant to reconcile two rows naming one thing.
   */
  it('increments the line when the same item is added again', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Fast Charger')
    await addViaSearch(user, 'Fast Charger')

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const { items } = createMutate.mock.calls[0][0]
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ productId: 'p-1', quantity: 2 })
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

/**
 * The line-level pricing panel: what it seeds, what it sends, and the two
 * refusals.
 *
 * The seed and the staged inputs are the parts that fail quietly. A cost seeded
 * over a figure the merchant typed loses their entry with no error; a staged
 * input that sends `0` instead of nothing would reprice every product on the
 * order to free the moment its goods arrive. Both are asserted on what the page
 * actually SENDS, not on what it renders.
 *
 * See openspec/changes/add-purchase-order-pricing.
 */
describe('PurchaseOrderFormPage — the line pricing panel', () => {
  /** Adds a simple product and opens its pricing panel. */
  const openPricingFor = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
    await addViaSearch(user, label)
    await user.click(await screen.findByRole('button', { name: new RegExp(`Show prices for ${label}`, 'i') }))
  }

  it('seeds unit cost from the item’s cost basis, and never over a typed figure', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await addViaSearch(user, 'Fast Charger')

    const cost = (await screen.findByLabelText('Unit cost for Fast Charger')) as HTMLInputElement
    await waitFor(() => expect(cost.value).toBe('90'))

    // The merchant overwrites it with what the supplier actually charged; a
    // later re-render must not put the cost basis back.
    await user.clear(cost)
    await user.type(cost, '95')
    await user.type(screen.getByLabelText('Quantity for Fast Charger'), '0')

    await waitFor(() => expect((screen.getByLabelText('Unit cost for Fast Charger') as HTMLInputElement).value).toBe('95'))
  })

  /*
   * REGRESSION. Each line must seed from the item IT names, including a product
   * the form has already resolved once.
   *
   * The seed was a `useEffect` over `[watchedItems, productById]` and this
   * sequence defeated it: `form.watch` returns the same mutated array, and a
   * product already resolved leaves `productById` identical, so neither
   * dependency changed and the effect never ran. The third line silently kept
   * the second line's cost — the merchant's own report was "I select a product,
   * then another, then the first again and the unit cost does not change".
   */
  it('seeds each line from its own product, including one already resolved', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await addViaSearch(user, 'Fast Charger')
    await waitFor(() =>
      expect((screen.getByLabelText('Unit cost for Fast Charger') as HTMLInputElement).value).toBe('90'),
    )

    await addViaSearch(user, 'No Cost Item')
    const second = (await screen.findByLabelText('Unit cost for No Cost Item')) as HTMLInputElement
    await user.clear(second)
    await user.type(second, '77')

    /*
     * Back to the first product — already resolved, so the old effect saw no
     * change and skipped it. It increments line 1, whose cost must still be its
     * own 90 and not the 77 typed on line 2.
     */
    await addViaSearch(user, 'Fast Charger')

    await waitFor(() =>
      expect((screen.getByLabelText('Unit cost for Fast Charger') as HTMLInputElement).value).toBe('90'),
    )
    expect((screen.getByLabelText('Unit cost for No Cost Item') as HTMLInputElement).value).toBe('77')
  })

  it('leaves unit cost alone for an item with no cost basis', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    const cost = screen.getByLabelText('Unit cost for line 1') as HTMLInputElement
    await user.clear(cost)
    await user.type(cost, '42')

    await addViaSearch(user, 'No Cost Item')

    // A null cost basis is unknown, not zero — writing 0 here would read as a
    // supplier who charged nothing.
    await waitFor(() =>
      expect((screen.getByLabelText('Unit cost for No Cost Item') as HTMLInputElement).value).toBe('42'),
    )
  })

  it('shows the item’s current prices, with a variant’s own taking precedence', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await addViaSearch(user, 'Q86 Retro')
    await user.click(await screen.findByRole('option', { name: /Red/ }))
    await user.click(await screen.findByRole('button', { name: /Show prices for Q86 Retro/i }))

    /*
     * Red sets its own cost and offer price and inherits the parent's regular
     * price — the per-field precedence, not whole-row.
     *
     * Scoped to the panel: the variant's cost also seeds Unit cost, so the same
     * figure legitimately appears in the row's Amount cell as well.
     */
    const panel = await screen.findByText('Currently in the catalogue')
    const catalogue = panel.parentElement as HTMLElement

    await waitFor(() => expect(within(catalogue).getByText(formatCurrency(120))).toBeTruthy())
    expect(within(catalogue).getByText(formatCurrency(200))).toBeTruthy()
    expect(within(catalogue).getByText(formatCurrency(175))).toBeTruthy()
  })

  it('sends no staged prices for a line the merchant left alone', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await addViaSearch(user, 'Fast Charger')
    await user.click(screen.getByRole('button', { name: /create purchase order/i }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const [item] = createMutate.mock.calls[0][0].items
    // Absent, not 0: absent means "no opinion" and the receipt changes nothing.
    expect(item.stagedOfferPrice).toBeUndefined()
    expect(item.stagedSellingPrice).toBeUndefined()
  })

  it('sends a staged price the merchant sets, and only that one', async () => {
    const user = userEvent.setup()
    render(<PurchaseOrderFormPage />)

    await chooseSupplier(user)
    await openPricingFor(user, 'Fast Charger')

    await user.type(screen.getByLabelText('New offer price for Fast Charger'), '170')
    await user.click(screen.getByRole('button', { name: /create purchase order/i }))

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const [item] = createMutate.mock.calls[0][0].items
    expect(item.stagedOfferPrice).toBe(170)
    // The regular price was never touched, so the receipt must leave it alone.
    expect(item.stagedSellingPrice).toBeUndefined()
  })

  /*
   * The markup and fixed-adjust helpers had four tests here, removed with the
   * controls themselves (design.md Decision 4, reversed on request — see the
   * note on `LinePricing`). The arithmetic they covered still exists on the
   * server and is still pinned by `scripts/verify-cost-basis.ts`; what is gone
   * is the admin's mirror of it, so there is nothing left in this file to
   * assert about it. The two staged inputs remain covered above and below.
   */
})
