/**
 * The one guarantee this screen exists to make: an UNCONFIRMED order is never
 * offered a retry.
 *
 * Aborting a dispatch request does not abort Steadfast's handler, so an
 * unconfirmed consignment may already exist. Sending it again is how a merchant
 * pays for two pickups of one parcel — so the absence of that control is the
 * feature, and a refactor that "helpfully" adds a retry-all button would undo
 * it silently. Hence a test on absence.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchResult } from '@/features/sales/courier/dispatch-result'
import type { CourierDispatchSummary } from '@/lib/api/courier'

const summary = (over: Partial<CourierDispatchSummary> = {}): CourierDispatchSummary => ({
  dispatched: 0,
  ineligible: 0,
  failed: 0,
  unconfirmed: 0,
  results: [],
  ...over,
})

describe('DispatchResult', () => {
  it('offers no retry when the only bad outcome is unconfirmed', () => {
    render(
      <DispatchResult
        summary={summary({
          unconfirmed: 1,
          results: [
            {
              orderId: 'o1',
              orderNumber: 'ORD-1001',
              outcome: 'unconfirmed',
              detail: 'The courier did not respond in time.',
            },
          ],
        })}
        onRetryFailed={vi.fn()}
      />,
    )

    expect(screen.getByText('ORD-1001')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('tells the operator to check before sending an unconfirmed order again', () => {
    render(
      <DispatchResult
        summary={summary({
          unconfirmed: 1,
          results: [{ orderId: 'o1', orderNumber: 'ORD-1001', outcome: 'unconfirmed' }],
        })}
      />,
    )

    expect(screen.getByText(/check them in Steadfast before sending again/i)).toBeTruthy()
  })

  it('offers retry for a definite failure', () => {
    render(
      <DispatchResult
        summary={summary({
          failed: 1,
          results: [
            {
              orderId: 'o2',
              orderNumber: 'ORD-1002',
              outcome: 'failed',
              detail: 'The courier rejected this consignment.',
            },
          ],
        })}
        onRetryFailed={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /retry 1 failed/i })).toBeTruthy()
  })

  it('retries only the failed orders, never the unconfirmed ones', async () => {
    const onRetryFailed = vi.fn()
    const userEvent = (await import('@testing-library/user-event')).default

    render(
      <DispatchResult
        summary={summary({
          failed: 1,
          unconfirmed: 1,
          results: [
            { orderId: 'o1', orderNumber: 'ORD-1001', outcome: 'unconfirmed' },
            { orderId: 'o2', orderNumber: 'ORD-1002', outcome: 'failed' },
          ],
        })}
        onRetryFailed={onRetryFailed}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /retry 1 failed/i }))

    expect(onRetryFailed).toHaveBeenCalledWith(['o2'])
  })

  it('shows a tracking code for a dispatched order', () => {
    render(
      <DispatchResult
        summary={summary({
          dispatched: 1,
          results: [
            {
              orderId: 'o3',
              orderNumber: 'ORD-1003',
              outcome: 'dispatched',
              consignmentId: '1424107',
              trackingCode: '15BAEB8A',
            },
          ],
        })}
      />,
    )

    expect(screen.getByText('15BAEB8A')).toBeTruthy()
    expect(screen.getByText('#1424107')).toBeTruthy()
  })

  it('renders nothing for an outcome group with no orders', () => {
    render(<DispatchResult summary={summary()} />)

    expect(screen.queryByText(/Sent to Steadfast/)).toBeNull()
    expect(screen.queryByText(/Outcome unknown/)).toBeNull()
  })
})
