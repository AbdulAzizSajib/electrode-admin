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

import CheckoutSettingsPage from './checkout-settings-page'

function renderPage() {
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <CheckoutSettingsPage /> }], {
        initialEntries: ['/'],
      })}
    />,
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
