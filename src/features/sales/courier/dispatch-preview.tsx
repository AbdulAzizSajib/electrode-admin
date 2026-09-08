/**
 * The dispatch flow: preview what will go, confirm, then read the outcome.
 *
 * The preview is a real server round-trip, never a client-side filter on order
 * status. Eligibility depends on things this panel does not hold — whether a
 * composed address exceeds 250 characters, whether a stored phone converts to
 * the courier's format — and guessing at them would show a preview the dispatch
 * then contradicts. See design.md Decision 3.
 */
import * as React from 'react'
import { AlertTriangle, CheckCircle2, Truck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { INELIGIBLE_LABEL } from '@/features/sales/courier/courier-presentation'
import { DispatchResult } from '@/features/sales/courier/dispatch-result'
import {
  useDispatchOrders,
  usePreviewDispatch,
  type CourierDispatchSummary,
  type CourierEligibility,
} from '@/lib/api/courier'
import { ApiError } from '@/lib/api/client'

export function DispatchDialog({
  orderIds,
  open,
  onOpenChange,
  onDispatched,
}: {
  orderIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired once a dispatch has completed, so the caller can clear its selection. */
  onDispatched?: (summary: CourierDispatchSummary) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * Mounted only while open, so each opening starts from empty state. That
       * replaces a reset-then-fetch effect: clearing three pieces of state
       * synchronously inside an effect is exactly the cascading-render pattern
       * the compiler lint rejects, and remounting says the same thing without
       * the machinery.
       *
       * Deliberately NOT keyed on the ids. A key derived from `orderIds` looks
       * harmless and is not: a successful dispatch clears the caller's
       * selection, which empties `orderIds`, which changes the key, which
       * remounts this body — throwing away the result the operator is reading
       * and re-running the preview against an empty selection, so the result
       * screen is replaced by "Select at least one order".
       */}
      {open ? (
        <DispatchBody
          orderIds={orderIds}
          onClose={() => onOpenChange(false)}
          onDispatched={onDispatched}
        />
      ) : null}
    </Dialog>
  )
}

function DispatchBody({
  orderIds: incomingIds,
  onClose,
  onDispatched,
}: {
  orderIds: string[]
  onClose: () => void
  onDispatched?: (summary: CourierDispatchSummary) => void
}) {
  /*
   * The selection as it stood when this dialog opened, captured once.
   *
   * The caller clears its selection on a successful dispatch — correctly, so the
   * operator cannot re-send the same parcels — which empties the incoming prop
   * while the result is still on screen. Reading the prop directly would then
   * show "Send 0 orders to Steadfast" above a list of what was just sent.
   */
  const [orderIds] = React.useState(incomingIds)

  const preview = usePreviewDispatch()
  const dispatch = useDispatchOrders()

  const [verdicts, setVerdicts] = React.useState<CourierEligibility[] | null>(null)
  const [summary, setSummary] = React.useState<CourierDispatchSummary | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const previewMutate = preview.mutateAsync

  React.useEffect(() => {
    let cancelled = false

    previewMutate(orderIds)
      .then((result) => {
        if (!cancelled) setVerdicts(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not check these orders.')
        }
      })

    return () => {
      cancelled = true
    }
    // `orderIds` is a fresh array each render; its contents are what matter, and
    // a change of contents remounts this component anyway via its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMutate])

  const eligible = verdicts?.filter((v) => v.eligible) ?? []
  const excluded = verdicts?.filter((v) => !v.eligible) ?? []

  const run = async (ids: string[]) => {
    setError(null)
    try {
      const result = await dispatch.mutateAsync(ids)
      setSummary(result)
      onDispatched?.(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The dispatch could not be completed.')
    }
  }

  return (
    <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {summary ? 'Dispatch result' : `Send ${orderIds.length} order${orderIds.length === 1 ? '' : 's'} to Steadfast`}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {summary ? (
          <>
            <DispatchResult
              summary={summary}
              isRetrying={dispatch.isPending}
              onRetryFailed={(ids) => void run(ids)}
            />
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : preview.isPending || (!verdicts && !error) ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <>
            {eligible.length > 0 ? (
              <section className="rounded-md border border-border">
                <header className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <h3 className="text-sm font-medium text-foreground">
                    Will be sent ({eligible.length})
                  </h3>
                </header>
                <ul className="divide-y divide-border">
                  {eligible.map((v) => (
                    <li key={v.orderId} className="px-3 py-2 text-sm font-medium text-foreground">
                      {v.orderNumber}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {excluded.length > 0 ? (
              <section className="rounded-md border border-border">
                <header className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <AlertTriangle className="size-4 text-warning" />
                  <h3 className="text-sm font-medium text-foreground">
                    Will be skipped ({excluded.length})
                  </h3>
                </header>
                <ul className="divide-y divide-border">
                  {excluded.map((v) => (
                    <li key={v.orderId} className="px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{v.orderNumber}</span>{' '}
                      <span className="text-muted-foreground">
                        — {v.reason ? INELIGIBLE_LABEL[v.reason] : 'Not eligible'}
                        {v.detail ? `: ${v.detail}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {/*
               * No confirm at all when nothing can go — an enabled button that
               * would dispatch zero orders is a control that lies about what it
               * does. Disabled while in flight so one confirmation cannot be
               * sent twice.
               */}
              {eligible.length > 0 ? (
                <Button
                  disabled={dispatch.isPending}
                  onClick={() => void run(eligible.map((v) => v.orderId))}
                >
                  <Truck />
                  {dispatch.isPending
                    ? 'Sending…'
                    : `Send ${eligible.length} to Steadfast`}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  None of these orders can be sent yet.
                </p>
              )}
            </div>
          </>
        )}
    </DialogContent>
  )
}
