/**
 * Courier account state.
 *
 * Deliberately thin. Dispatching happens on the orders list, where the parcels
 * are; this page exists so the account-level facts — what the configured
 * courier currently holds, and whether it is configured at all — have somewhere
 * to live that is not bolted onto a list of orders.
 *
 * WHICH courier is chosen on UI → Courier Setting, not here. This page reports
 * on the choice; that one makes it.
 */
import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { CourierBalanceCard } from '@/features/sales/courier/courier-balance'
import { useConfiguredCourier } from '@/lib/api/courier'

export default function CourierPage() {
  const courier = useConfiguredCourier()
  const courierName = courier?.displayName ?? 'Courier'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Courier"
        description={`${courierName} account status. Orders are dispatched from the Orders list.`}
      />

      {/*
       * A courier with no integration has no account state to report, so the
       * page says what IS true rather than rendering empty cards.
       */}
      {courier && !courier.capabilities.dispatch ? (
        <Card className="flex flex-col gap-1 p-4">
          <span className="font-medium text-foreground">No courier integration</span>
          <span className="text-sm text-muted-foreground">
            This shop is set to {courierName}, so parcels are handed over by hand and recorded on
            each order. Change this on{' '}
            <Link className="underline underline-offset-2" to="/ui/courier-settings">
              Courier Setting
            </Link>
            .
          </span>
        </Card>
      ) : (
        <div className="max-w-sm">
          <CourierBalanceCard />
        </div>
      )}
    </div>
  )
}
