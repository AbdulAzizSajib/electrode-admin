import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { LayoutGrid } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import { useCollections, useDeleteCollection, type Collection } from '@/lib/api/collections'
import { formatDate } from '@/lib/utils/format'

export const COLLECTIONS_PATH = '/catalog/collections'

export default function CollectionsPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteCollection()

  const columns: ColumnDef<Collection>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: 'Address',
      cell: ({ row }) => <span className="text-muted-foreground">/{row.original.slug}</span>,
    },
    {
      id: 'isVisible',
      header: 'Visibility',
      cell: ({ row }) => (
        <Badge variant={row.original.isVisible ? 'success' : 'secondary'}>
          {row.original.isVisible ? 'Visible' : 'Hidden'}
        </Badge>
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
      title="Collections"
      description="Merchandising groups a product can belong to, independent of its category."
      noun="collection"
      icon={LayoutGrid}
      emptyTitle="No collections yet"
      emptyDescription="Group products for the storefront without changing their categories."
      searchPlaceholder="Search collections…"
      columns={columns}
      useList={useCollections}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={() => navigate(`${COLLECTIONS_PATH}/new`)}
      onEdit={(row) => navigate(`${COLLECTIONS_PATH}/${row.id}`)}
      remove={{
        // Nothing to reassign or confirm: a product without a collection is
        // perfectly sellable, so only the memberships go.
        mode: 'simple',
        remove: ({ id }) => deleteMutation.mutateAsync(id),
        confirmDescription:
          'The products in it are not affected — they simply stop belonging to this collection.',
      }}
    />
  )
}
