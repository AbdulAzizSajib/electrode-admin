/**
 * Turns "the pulse shows a newer order than last time" into a toast and a chime.
 *
 * The tricky part is not the alert, it's not alerting: opening the panel must not announce
 * orders that were already there, and a reload must not re-announce one that already alerted.
 * Both fall out of establishing a baseline from the first pulse and never treating it as new.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/use-toast'
import type { Pulse } from '@/lib/api/pulse'
import { armAlertSound, playOrderAlert } from '@/lib/realtime/alert-sound'
import { SOUND_MUTED_KEY } from '@/lib/realtime/config'

function readMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === 'true'
  } catch {
    // Private-mode or storage-disabled browsers: default to audible rather than silently muted,
    // since a missed order is the costlier failure.
    return false
  }
}

/** The mute toggle's state, persisted so it survives reloads and new sessions on this browser. */
export function useOrderAlertSound() {
  const [muted, setMuted] = useState(readMuted)

  const toggleMuted = useCallback(() => {
    setMuted((previous) => {
      const next = !previous
      try {
        localStorage.setItem(SOUND_MUTED_KEY, String(next))
      } catch {
        // Preference just won't persist; the in-session toggle still works.
      }
      // Unmuting is itself a user gesture — the one moment we're guaranteed to be allowed to
      // unlock audio, so the next order actually makes a sound.
      if (!next) armAlertSound()
      return next
    })
  }, [])

  return { muted, toggleMuted }
}

/**
 * Watches the shared pulse and alerts on newly placed orders.
 *
 * Mounted once alongside `useRealtime`. `muted` is passed in rather than read here so the
 * topbar's toggle and this hook can't disagree about the current setting.
 */
export function useOrderAlert(pulse: Pulse | undefined, muted: boolean): void {
  /*
   * The last order id this panel has accounted for. `undefined` means "no baseline yet" — the
   * first pulse sets it without alerting, which is what stops a page load from announcing
   * every order already in the system.
   */
  const lastSeenOrderId = useRef<string | undefined>(undefined)
  const lastOrderCount = useRef<number | undefined>(undefined)

  // Read through a ref so a change of mute state doesn't re-run the alert effect and re-fire
  // an alert for an order already handled.
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  useEffect(() => {
    if (!pulse) return

    const { latestOrder, orderCount } = pulse

    if (!latestOrder) {
      lastOrderCount.current = orderCount
      return
    }

    // First pulse of the session: adopt the current state as the baseline, announce nothing.
    if (lastSeenOrderId.current === undefined) {
      lastSeenOrderId.current = latestOrder.id
      lastOrderCount.current = orderCount
      return
    }

    if (latestOrder.id === lastSeenOrderId.current) return

    /*
     * More than one order can land between two polls. Counting them from `orderCount` rather
     * than assuming one keeps the toast honest, and one alert for the batch keeps a burst from
     * turning into a stack of toasts and a run of chimes.
     */
    const previousCount = lastOrderCount.current ?? orderCount
    const newOrders = Math.max(1, orderCount - previousCount)

    lastSeenOrderId.current = latestOrder.id
    lastOrderCount.current = orderCount

    toast({
      title: newOrders === 1 ? 'New order received' : `${newOrders} new orders received`,
      description:
        newOrders === 1
          ? `Order ${latestOrder.orderNumber} was just placed.`
          : `Latest: order ${latestOrder.orderNumber}.`,
    })

    if (!mutedRef.current) playOrderAlert()
  }, [pulse])
}
