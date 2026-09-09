/**
 * The configured courier's account balance.
 *
 * Fetched on demand rather than on mount: every read is a live call to the
 * courier, and a widget that polls their API each time a page opens is rude to
 * a service the shop depends on.
 *
 * An unavailable balance says so. Showing 0 would be a figure that looks like an
 * answer — and "your courier account is empty" is exactly the wrong thing to
 * tell a merchant whose network happened to blip.
 */
import { RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfiguredCourier, useCourierBalance } from '@/lib/api/courier'
import { ApiError } from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils/format'

export function CourierBalanceCard() {
  const { data, isFetching, isError, error, refetch } = useCourierBalance(false)
  const courier = useConfiguredCourier()

  /*
   * Rendered as nothing where the courier has no balance endpoint. Not every
   * courier exposes one, and a card whose only possible content is "this does
   * not work here" is worse than an absent card.
   */
  if (courier && !courier.capabilities.balance) return null

  const courierName = courier?.displayName ?? 'The courier'

  /*
   * 503 is the server saying the courier is not configured — a setup gap, not a
   * failure. It is worth distinguishing, because the fix is a deployment
   * setting rather than a retry.
   */
  const notConfigured = error instanceof ApiError && error.status === 503

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" /> Courier balance
        </CardTitle>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
          {data === undefined ? 'Check' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <Skeleton className="h-6 w-24" />
        ) : notConfigured ? (
          <p className="text-sm text-muted-foreground">
            {courierName} is not configured on the server, so there is no balance to read.
          </p>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Balance unavailable —{' '}
            {error instanceof Error ? error.message : 'the courier could not be reached'}.
          </p>
        ) : data === undefined ? (
          <p className="text-sm text-muted-foreground">
            Not checked yet. Reading it calls {courierName} directly.
          </p>
        ) : (
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(data.currentBalance)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
