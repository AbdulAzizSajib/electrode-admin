import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useOrderAlert } from '@/lib/realtime/use-order-alert'
import type { Pulse } from '@/lib/api/pulse'

/**
 * Covers the two alert rules that are easy to regress and expensive to get wrong: opening the
 * panel must not announce orders that were already there, and a burst between polls must not
 * turn into a stack of toasts and a run of chimes.
 *
 * The sound module is mocked because jsdom has no Web Audio; what matters here is how many
 * times it was asked to play, not what came out.
 */

const toastMock = vi.hoisted(() => vi.fn())
const playMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/ui/use-toast', () => ({ toast: toastMock }))
vi.mock('@/lib/realtime/alert-sound', () => ({ playOrderAlert: playMock, armAlertSound: vi.fn() }))

function pulseWith(orderId: string, orderCount: number): Pulse {
  return {
    latestOrder: { id: orderId, orderNumber: `ORD-${orderId}`, totalAmount: 100, createdAt: '2026-01-01T00:00:00Z' },
    orderCount,
    pendingOrderCount: 1,
    unreadNotificationCount: 0,
    lowStockCount: 0,
    lastEventAt: '2026-01-01T00:00:00Z',
  }
}

function Harness({ pulse, muted = false }: { pulse: Pulse | undefined; muted?: boolean }) {
  useOrderAlert(pulse, muted)
  return null
}

describe('useOrderAlert', () => {
  beforeEach(() => {
    toastMock.mockClear()
    playMock.mockClear()
  })

  it('stays silent for orders that already existed when the panel opened', () => {
    render(<Harness pulse={pulseWith('a', 12)} />)

    expect(toastMock).not.toHaveBeenCalled()
    expect(playMock).not.toHaveBeenCalled()
  })

  it('alerts once for a batch of orders arriving between polls', () => {
    const { rerender } = render(<Harness pulse={pulseWith('a', 12)} />)
    rerender(<Harness pulse={pulseWith('d', 15)} />)

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock.mock.calls[0][0].title).toContain('3 new orders')
    expect(playMock).toHaveBeenCalledTimes(1)
  })

  it('shows the alert but skips the sound when muted', () => {
    const { rerender } = render(<Harness pulse={pulseWith('a', 12)} muted />)
    rerender(<Harness pulse={pulseWith('b', 13)} muted />)

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(playMock).not.toHaveBeenCalled()
  })
})
