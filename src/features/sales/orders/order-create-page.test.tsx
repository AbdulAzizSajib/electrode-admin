import type * as React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// The default 5s is a scheduling artifact once the suite runs many workers in
// parallel; these render a full form and type into it.
vi.setConfig({ testTimeout: 20_000 })
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * What the manual order page promises, asserted against the real page.
 *
 * The assertions worth having are the ones that fail SILENTLY, and on this page
 * they all come from the same place: an operator using it has a customer on the
 * phone. A refused save that clears the form costs a ten-minute conversation. A
 * unit price that looks editable but is ignored produces an order at a price
 * nobody agreed. A double-click that creates two orders sends two parcels, and
 * unlike a shopper double-clicking checkout there is nobody at the other end to
 * notice.
 *
 * Everything under the page is stubbed — the API hooks, the router, the toast.
 * What is under test is the page's own decisions: what it sends, what it
 * refuses to send, and what it keeps when the server says no.
 */

const navigate = vi.hoisted(() => vi.fn())
const createMutate = vi.hoisted(() => vi.fn())
const quoteMutate = vi.hoisted(() => vi.fn())

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate }
})

/*
 * `p-1` is simple and `p-2` is variable, because the two take different paths
 * through a line row: only the second gets a variant picker, and only the second
 * can fail to name one. The LIST rows deliberately carry no `variants` key — the
 * real `GET /products/admin` omits it, which is exactly why the row fetches the
 * detail.
 */
const PRODUCT_DETAIL: Record<string, Record<string, unknown>> = {
  'p-1': { id: 'p-1', name: 'Fast Charger', offerPrice: '500', images: [], variants: [] },
  'p-2': {
    id: 'p-2',
    name: 'Q86 Retro',
    offerPrice: '1200',
    images: [{ url: 'https://example.test/q86.jpg' }],
    variants: [
      { id: 'v-red', name: 'Red', sku: 'q86-red', offerPrice: '1300', image: null },
      { id: 'v-white', name: 'White', sku: 'q86-white', offerPrice: '1250', image: null },
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

const settings = vi.hoisted(() => ({
  value: {
    checkoutConfig: {
      delivery: {
        offersPickup: false,
        options: [{ key: 'inside-dhaka', label: 'Inside Dhaka', kind: 'DELIVERY', price: 60, days: 2 }],
      },
    },
  } as Record<string, unknown> | undefined,
  loading: false,
}))

vi.mock('@/lib/api/store-settings', () => ({
  useStoreSettings: () => ({ data: settings.value, isLoading: settings.loading }),
}))

vi.mock('@/lib/api/orders', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/orders')>('@/lib/api/orders')
  return {
    ...actual,
    useCreateManualOrder: () => ({ mutateAsync: createMutate, isPending: false }),
    useManualOrderQuote: () => ({ mutateAsync: quoteMutate, isPending: false }),
  }
})

vi.mock('@/components/layout/breadcrumb-context', () => ({ useBreadcrumbLabel: () => {} }))
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }))

import { MemoryRouter } from 'react-router'
import OrderCreatePage from '@/features/sales/orders/order-create-page'

/*
 * The page renders a <Link> to the delivery settings, and ResourceFormLayout
 * links too — both need router context. Only useNavigate is stubbed above, so
 * everything else here is the real react-router and wants a real Router.
 */
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

const QUOTE = {
  subtotal: 1000,
  discountAmount: 0,
  taxAmount: 0,
  shippingAmount: 60,
  shippingBeforeWaiver: 60,
  deliveryDays: 2,
  totalAmount: 1060,
  delivery: {
    optionKey: 'inside-dhaka',
    optionLabel: 'Inside Dhaka',
    method: 'DELIVERY' as const,
    price: 60,
    days: 2,
  },
}

beforeEach(() => {
  // Radix's Select measures and captures the pointer; jsdom implements neither.
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()

  navigate.mockReset()
  createMutate.mockReset()
  quoteMutate.mockReset()
  quoteMutate.mockResolvedValue(QUOTE)
  settings.loading = false
  settings.value = {
    checkoutConfig: {
      delivery: {
        offersPickup: false,
        options: [{ key: 'inside-dhaka', label: 'Inside Dhaka', kind: 'DELIVERY', price: 60, days: 2 }],
      },
    },
  }
})

/** Picks an option out of a `Combobox`, which is a button that opens a listbox. */
const pickCombobox = async (
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  optionName: RegExp,
) => {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

/** Chooses an option from a Radix Select, which is a trigger plus a listbox. */
const pickSelect = async (
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  optionName: RegExp,
) => {
  await user.click(screen.getByLabelText(label))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

/** Fills everything the form needs except the lines. */
const fillCustomer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/phone number/i), '01712345678')
  await user.type(screen.getByLabelText(/^name$/i), 'Rahim')
  await user.type(screen.getByLabelText(/^address$/i), 'House 12, Road 5')
}

const save = async (user: ReturnType<typeof userEvent.setup>) => {
  // The scaffold offers 'Save and continue editing' and 'Save and return'.
  // The first is the one that keeps the operator on the form, which is where a
  // refusal has to be visible.
  await user.click(screen.getByRole('button', { name: /save and continue editing/i }))
}

describe('OrderCreatePage — prices are shown, never typed', () => {
  it('renders the catalogue price as text with no control bound to it', async () => {
    const user = userEvent.setup()
    render(<OrderCreatePage />)

    await pickCombobox(user, /product for line 1/i, /fast charger/i)

    // The price is on screen…
    expect(await screen.findByText('৳500.00')).toBeTruthy()

    // …and there is no field offering to change it. Every spinbutton on this
    // form is a quantity or the discount; none is a unit price.
    const numericFields = screen.getAllByRole('spinbutton')
    for (const field of numericFields) {
      expect(field.getAttribute('name') ?? '').not.toMatch(/unitPrice|price/i)
    }
  })
})

describe('OrderCreatePage — what it refuses to send', () => {
  it('refuses an order with no lines and sends nothing', async () => {
    const user = userEvent.setup()
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await save(user)

    await screen.findByText(/some fields need attention/i)
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('refuses a discount with no reason, and marks the reason field', async () => {
    const user = userEvent.setup()
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await pickCombobox(user, /product for line 1/i, /fast charger/i)
    await user.type(screen.getByLabelText(/^discount$/i), '100')
    await save(user)

    expect(await screen.findByText(/give a reason/i)).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('refuses a discount larger than the quoted subtotal', async () => {
    const user = userEvent.setup()
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await pickCombobox(user, /product for line 1/i, /fast charger/i)
    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    await waitFor(() => expect(quoteMutate).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^discount$/i), '99999')
    await user.type(screen.getByLabelText(/reason for the discount/i), 'Too generous')
    await save(user)

    // Twice, and rightly: once on the field and once in the banner above the form.
    expect((await screen.findAllByText(/more than the order/i)).length).toBeGreaterThan(0)
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('refuses a variable product whose line names no variant', async () => {
    const user = userEvent.setup()
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await pickCombobox(user, /product for line 1/i, /q86 retro/i)

    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    await waitFor(() => expect(quoteMutate).toHaveBeenCalled())
    await save(user)

    expect(await screen.findByText(/must say which variant/i)).toBeTruthy()
    expect(createMutate).not.toHaveBeenCalled()
  })
})

describe('OrderCreatePage — a refused save costs the operator nothing', () => {
  it("keeps every entered value and line, and shows the backend's own reason", async () => {
    const user = userEvent.setup()
    createMutate.mockRejectedValue(
      new Error('Insufficient stock for "Fast Charger" — requested 2, available 1'),
    )
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await user.type(screen.getByLabelText(/notes/i), 'Deliver after 5pm')
    await pickCombobox(user, /product for line 1/i, /fast charger/i)

    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    await waitFor(() => expect(quoteMutate).toHaveBeenCalled())
    await save(user)

    // The backend's own wording, not a paraphrase — it names the short line.
    expect(await screen.findByText(/insufficient stock for "fast charger"/i)).toBeTruthy()

    // And nothing the operator typed has moved.
    expect((screen.getByLabelText(/phone number/i) as HTMLInputElement).value).toBe('01712345678')
    expect((screen.getByLabelText(/^address$/i) as HTMLInputElement).value).toBe('House 12, Road 5')
    expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe('Deliver after 5pm')
    expect(screen.getByRole('combobox', { name: /product for line 1/i }).textContent).toMatch(/fast charger/i)
  })

  it('retries the same order under the same idempotency key', async () => {
    const user = userEvent.setup()
    createMutate.mockRejectedValueOnce(new Error('Network is unreachable'))
    createMutate.mockResolvedValueOnce({ id: 'o-1' })
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await pickCombobox(user, /product for line 1/i, /fast charger/i)

    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    await waitFor(() => expect(quoteMutate).toHaveBeenCalled())

    await save(user)
    await screen.findByText(/network is unreachable/i)
    await save(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(2))
    const [first] = createMutate.mock.calls[0] as [{ idempotencyKey: string }]
    const [second] = createMutate.mock.calls[1] as [{ idempotencyKey: string }]
    // A resubmission is a RETRY, not a second order — so the server can absorb
    // it rather than send the customer two parcels.
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })
})

describe('OrderCreatePage — a successful save', () => {
  it('sends catalogue ids and quantities only, then opens the created order', async () => {
    const user = userEvent.setup()
    createMutate.mockResolvedValue({ id: 'o-99' })
    render(<OrderCreatePage />)

    await fillCustomer(user)
    await pickCombobox(user, /product for line 1/i, /fast charger/i)
    await user.clear(screen.getAllByRole('spinbutton')[0])
    await user.type(screen.getAllByRole('spinbutton')[0], '2')

    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    await waitFor(() => expect(quoteMutate).toHaveBeenCalled())
    await save(user)

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    const [payload] = createMutate.mock.calls[0] as [
      { input: { items: Record<string, unknown>[]; channel: string; phone: string } },
    ]

    expect(payload.input.phone).toBe('01712345678')
    expect(payload.input.channel).toBe('WHATSAPP')
    expect(payload.input.items).toEqual([{ productId: 'p-1', quantity: 2 }])
    // No price of any shape reaches the request.
    expect(JSON.stringify(payload.input)).not.toMatch(/unitPrice|offerPrice/)

    expect(navigate).toHaveBeenCalledWith('/sales/orders/o-99', { replace: true })
  })
})

describe('OrderCreatePage — the delivery select waits for its options', () => {
  it('shows a skeleton instead of an empty select while settings load', () => {
    settings.loading = true
    settings.value = undefined
    render(<OrderCreatePage />)

    // A Radix Select mounted before its data clears react-hook-form's value on
    // the render the options arrive — the trap CLAUDE.md records. So until the
    // options exist there must be no combobox for them.
    expect(screen.queryByLabelText(/delivery option/i)).toBeNull()
    expect(screen.getAllByText(/delivery option/i).length).toBeGreaterThan(0)
  })

  it('says so when the store has no delivery options configured', () => {
    settings.value = { checkoutConfig: { delivery: { offersPickup: false, options: [] } } }
    render(<OrderCreatePage />)

    expect(screen.getByText(/no delivery options are set up/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /add a delivery option/i })).toBeTruthy()
  })
})

describe('OrderCreatePage — the total is the server\'s, not the page\'s', () => {
  it('renders the quoted figures rather than computing them', async () => {
    const user = userEvent.setup()
    quoteMutate.mockResolvedValue({ ...QUOTE, taxAmount: 37, totalAmount: 1097 })
    render(<OrderCreatePage />)

    await pickCombobox(user, /product for line 1/i, /fast charger/i)
    await pickSelect(user, /delivery option/i, /inside dhaka/i)

    // 1097 is not derivable from anything on screen — it is what the server
    // said, which is the point.
    const total = await screen.findByText('৳1,097.00')
    expect(total).toBeTruthy()
    expect(within(total.closest('div')!).getByText(/total/i)).toBeTruthy()
  })
})
