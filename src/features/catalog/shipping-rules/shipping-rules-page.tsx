import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import {
  useAllShippingRules,
  useDeleteShippingRule,
  useShippingRules,
  type ShippingRule,
} from '@/lib/api/shipping-rules'
import {
  SHIPPING_RULES_PATH,
  destinationLabel,
} from '@/features/catalog/shipping-rules/shipping-rule-labels'
import { formatDate } from '@/lib/utils/format'

const PLACES_SHOWN = 3

export default function ShippingRulesPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteShippingRule()
  const { data: allRules = [] } = useAllShippingRules()

  const columns: ColumnDef<ShippingRule>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'places',
      header: 'Places',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.original.places.slice(0, PLACES_SHOWN).map((place) => (
            <Badge key={place.id} variant="secondary">
              {destinationLabel(place)} · {Number(place.price)}
            </Badge>
          ))}
          {row.original.places.length > PLACES_SHOWN && (
            <span className="text-xs text-muted-foreground">
              +{row.original.places.length - PLACES_SHOWN} more
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'pickup',
      header: 'Collection',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.places.some((place) => place.offersPickup) ? (
          <Badge variant="outline">Offered</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ]

  return (
    <ResourceListPage
      title="Shipping rules"
      description="A named delivery policy made of places. The most specific place covering a shopper wins."
      noun="shipping rule"
      icon={Truck}
      emptyTitle="No shipping rules yet"
      emptyDescription="Add a rule with at least one place so products can be delivered."
      searchPlaceholder="Search shipping rules…"
      columns={columns}
      useList={useShippingRules}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={() => navigate(`${SHIPPING_RULES_PATH}/new`)}
      onEdit={(row) => navigate(`${SHIPPING_RULES_PATH}/${row.id}`)}
      remove={{
        // A product must be deliverable, so its rule cannot simply disappear.
        mode: 'reassign',
        remove: ({ id, reassignToId }) => deleteMutation.mutateAsync({ id, reassignToId }),
        reassignOptions: () => allRules.map((rule) => ({ value: rule.id, label: rule.name })),
        reassignLabel: 'Move those products to',
      }}
    />
  )
}
