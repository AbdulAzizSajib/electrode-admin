import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Gift } from 'lucide-react'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import { useBundleDeals, useDeleteBundleDeal, type BundleDeal } from '@/lib/api/bundle-deals'
import { BUNDLE_DEALS_PATH, offerLabel } from '@/features/catalog/bundle-deals/bundle-deal-labels'
import { formatDate } from '@/lib/utils/format'


export default function BundleDealsPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteBundleDeal()

  const columns: ColumnDef<BundleDeal>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    { id: 'offer', header: 'Offer', cell: ({ row }) => offerLabel(row.original) },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ]

  return (
    <ResourceListPage
      title="Bundle deals"
      description="A “buy N, get M free” offer a product can carry."
      noun="bundle deal"
      icon={Gift}
      emptyTitle="No bundle deals yet"
      emptyDescription="Create an offer once and assign it to as many products as you like."
      searchPlaceholder="Search bundle deals…"
      columns={columns}
      useList={useBundleDeals}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={() => navigate(`${BUNDLE_DEALS_PATH}/new`)}
      onEdit={(row) => navigate(`${BUNDLE_DEALS_PATH}/${row.id}`)}
      remove={{
        // Products may carry no offer at all, so there is nothing to reassign —
        // but losing one is a commercial change the merchant should agree to
        // rather than hear about from a customer.
        mode: 'confirm',
        remove: ({ id, force }) => deleteMutation.mutateAsync({ id, force }),
      }}
    />
  )
}
