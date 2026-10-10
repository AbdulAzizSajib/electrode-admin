import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'

vi.setConfig({ testTimeout: 20_000 })

const updateMutate = vi.hoisted(() => vi.fn())
const settings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('@/lib/api/store-settings', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/store-settings')>('@/lib/api/store-settings')
  return {
    ...actual,
    useStoreSettings: () => ({ data: settings.current, isLoading: false, error: undefined }),
    useUpdateStoreSettings: () => ({ mutateAsync: updateMutate, isPending: false }),
  }
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CheckoutSettingsPage from './checkout-settings-page'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={createMemoryRouter([{ path: '/', element: <CheckoutSettingsPage /> }], {
          initialEntries: ['/'],
        })}
      />
    </QueryClientProvider>,
  )
}

describe('CheckoutSettingsPage delivery fee mode', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue({})
    settings.current = {
      checkoutConfig: {
        fields: {
          fullName: { show: true, required: true },
          phone: { show: true, required: true },
          addressLine1: { show: true, required: true },
          addressLine2: { show: true, required: false },
          city: { show: true, required: true },
          postalCode: { show: true, required: false },
        },
        showCouponBox: true,
        showOrderNote: true,
        allowGuestCheckout: true,
        notice: '',
        delivery: {
          feeMode: 'AUTOMATIC',
          offersPickup: false,
          options: [
            { key: 'inside-dhaka', label: 'Inside Dhaka', kind: 'DELIVERY', price: 80, days: 2 },
          ],
        },
        advancePayment: { enabled: false, mobileAccounts: [], bankAccounts: [] },
      },
    }
  })

  it('renders automatic mode by default and allows switching to manual mode', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText('Delivery fee calculation mode')).not.toBeNull()
    const manualRadio = screen.getByRole('radio', { name: /Manual/i })
    expect(manualRadio).not.toBeNull()
    expect(manualRadio.getAttribute('aria-checked')).toBe('false')

    const autoRadio = screen.getByRole('radio', { name: /Automatic/i })
    expect(autoRadio.getAttribute('aria-checked')).toBe('true')

    await user.click(manualRadio)
    expect(manualRadio.getAttribute('aria-checked')).toBe('true')

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalled()
      const payload = updateMutate.mock.calls[0][0]
      expect(payload.checkoutConfig.delivery.feeMode).toBe('MANUAL')
    })
  })
})

describe('CheckoutSettingsPage advance payment calculation mode', () => {
  beforeEach(() => {
    updateMutate.mockReset()
    updateMutate.mockResolvedValue({})
    settings.current = {
      checkoutConfig: {
        fields: {
          fullName: { show: true, required: true },
          phone: { show: true, required: true },
          addressLine1: { show: true, required: true },
          addressLine2: { show: true, required: false },
          city: { show: true, required: true },
          postalCode: { show: true, required: false },
        },
        showCouponBox: true,
        showOrderNote: true,
        allowGuestCheckout: true,
        notice: '',
        delivery: {
          feeMode: 'AUTOMATIC',
          offersPickup: false,
          options: [
            { key: 'inside-dhaka', label: 'Inside Dhaka', kind: 'DELIVERY', price: 80, days: 2 },
          ],
        },
        advancePayment: {
          enabled: true,
          calculationMode: 'PERCENTAGE',
          percentage: 10,
          fixedAmount: 100,
          mobileAccounts: [
            { id: 'acc-1', provider: 'BKASH', number: '01711111111', accountType: 'Personal' },
          ],
          bankAccounts: [],
        },
      },
    }
  })

  it('renders percentage mode by default and allows switching to fixed amount', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText('Advance payment calculation mode')).not.toBeNull()
    const pctRadio = screen.getByRole('radio', { name: /Percentage based/i })
    expect(pctRadio.getAttribute('aria-checked')).toBe('true')

    const fixedRadio = screen.getByRole('radio', { name: /Fixed amount/i })
    expect(fixedRadio.getAttribute('aria-checked')).toBe('false')

    await user.click(fixedRadio)
    expect(fixedRadio.getAttribute('aria-checked')).toBe('true')

    const fixedInput = screen.getByLabelText(/Fixed advance amount/i)
    expect(fixedInput).not.toBeNull()
    await user.clear(fixedInput)
    await user.type(fixedInput, '150')

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalled()
      const payload = updateMutate.mock.calls[0][0]
      expect(payload.checkoutConfig.advancePayment.calculationMode).toBe('FIXED')
      expect(payload.checkoutConfig.advancePayment.fixedAmount).toBe(150)
    })
  })
})

