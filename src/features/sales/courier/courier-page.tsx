/**
 * Courier account state.
 *
 * Deliberately thin. Dispatching happens on the orders list, where the parcels
 * are; this page exists so the account-level facts — what Steadfast currently
 * holds, and whether it is configured at all — have somewhere to live that is
 * not bolted onto a list of orders.
 */
import { PageHeader } from '@/components/ui/page-header'
import { CourierBalanceCard } from '@/features/sales/courier/courier-balance'

export default function CourierPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Courier"
        description="Steadfast account status. Orders are dispatched from the Orders list."
      />

      <div className="max-w-sm">
        <CourierBalanceCard />
      </div>
    </div>
  )
}
