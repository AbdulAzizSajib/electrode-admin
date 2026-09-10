/**
 * What happened to every order in a dispatch.
 *
 * The whole design of this screen turns on one distinction: `failed` orders
 * definitely have no consignment and are safe to send again; `unconfirmed` ones
 * may already have one nobody has seen. So retry is offered for failures ONLY,
 * and there is deliberately no "retry everything that didn't go" — that single
 * button is precisely the action the server's design works to prevent, because
 * it is how one parcel becomes two consignments billed to the merchant.
 * See design.md Decision 4.
 */
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { INELIGIBLE_LABEL } from '@/features/sales/courier/courier-presentation'
import type { CourierDispatchResult, CourierDispatchSummary } from '@/lib/api/courier'

function Section({
  icon: Icon,
  tone,
  title,
  description,
  rows,
  children,
}: {
  icon: typeof CheckCircle2
  tone: string
  title: string
  description?: string
  rows: CourierDispatchResult[]
  children?: React.ReactNode
}) {
  if (rows.length === 0) return null

  return (
    <section className="rounded-md border border-border">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">
            {title} ({rows.length})
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.orderId} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{row.orderNumber}</span>
            {row.trackingCode ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {row.trackingCode}
              </Badge>
            ) : null}
            {row.consignmentId ? (
              <span className="text-xs text-muted-foreground">#{row.consignmentId}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {row.reason ? INELIGIBLE_LABEL[row.reason] : row.detail}
            </span>
          </li>
        ))}
      </ul>

      {children ? <div className="border-t border-border px-3 py-2">{children}</div> : null}
    </section>
  )
}

export function DispatchResult({
  summary,
  courierName = 'the courier',
  onRetryFailed,
  isRetrying,
}: {
  summary: CourierDispatchSummary
  /**
   * The courier these orders went to.
   *
   * Passed in rather than fetched, so this component stays pure and testable —
   * and so a result rendered after a provider switch still names the courier
   * that actually received the parcels.
   */
  courierName?: string
  /** Retries the definite failures only. Never offered for unconfirmed orders. */
  onRetryFailed?: (orderIds: string[]) => void
  isRetrying?: boolean
}) {
  const by = (outcome: CourierDispatchResult['outcome']) =>
    summary.results.filter((r) => r.outcome === outcome)

  const failed = by('failed')

  return (
    <div className="flex flex-col gap-3">
      <Section
        icon={CheckCircle2}
        tone="text-success"
        title={`Sent to ${courierName}`}
        rows={by('dispatched')}
      />

      <Section
        icon={XCircle}
        tone="text-destructive"
        title="Failed"
        description="The courier rejected these, so nothing was created. They are safe to send again."
        rows={failed}
      >
        {onRetryFailed ? (
          <Button
            size="lg"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetryFailed(failed.map((r) => r.orderId))}
          >
            {isRetrying ? 'Retrying…' : `Retry ${failed.length} failed`}
          </Button>
        ) : null}
      </Section>

      {/*
       * No retry control here, deliberately. Aborting a request does not abort
       * the courier's handler, so these consignments may exist and nobody has
       * seen them yet. Sending again would create duplicates.
       */}
      <Section
        icon={HelpCircle}
        tone="text-warning"
        title="Outcome unknown"
        description={`The courier did not confirm these, so they may already have been created. Check them in ${courierName} before sending again — do not retry blindly.`}
        rows={by('unconfirmed')}
      />

      <Section
        icon={AlertTriangle}
        tone="text-muted-foreground"
        title="Skipped"
        description="These were not sent. Fix the reason on the order and dispatch it again."
        rows={by('ineligible')}
      />
    </div>
  )
}
