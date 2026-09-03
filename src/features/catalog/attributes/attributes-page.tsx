import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import { useAttributes, useDeleteAttribute, type Attribute } from '@/lib/api/attributes'
import { formatDate } from '@/lib/utils/format'

export const ATTRIBUTES_PATH = '/catalog/attributes'

/** How many value chips a row shows before collapsing the rest into a count. */
const VALUES_SHOWN = 6

export default function AttributesPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteAttribute()

  const columns: ColumnDef<Attribute>[] = [
    {
      accessorKey: 'name',
      header: 'Attribute',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'values',
      header: 'Values',
      enableSorting: false,
      cell: ({ row }) => {
        const values = row.original.values
        if (values.length === 0) {
          return <span className="text-muted-foreground">None</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {/* Authored order, not alphabetical — S / M / XL has to read
                correctly wherever it appears. */}
            {values.slice(0, VALUES_SHOWN).map((value) => (
              <Badge key={value.id} variant="secondary" className="gap-1">
                {row.original.presentation === 'SWATCH' && value.swatch && (
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full border border-border"
                    style={{ backgroundColor: value.swatch }}
                  />
                )}
                {value.label}
              </Badge>
            ))}
            {values.length > VALUES_SHOWN && (
              <span className="text-xs text-muted-foreground">
                +{values.length - VALUES_SHOWN} more
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'presentation',
      header: 'Shown as',
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.presentation === 'SWATCH' ? 'Colour swatches' : 'Labels'}
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
      title="Attributes"
      description="Defined once for the whole shop — Colour, Size, Weight — and selected on any product."
      noun="attribute"
      icon={SlidersHorizontal}
      emptyTitle="No attributes yet"
      emptyDescription="Define Colour or Size once here and reuse it on every product that sells it."
      searchPlaceholder="Search attributes…"
      columns={columns}
      useList={useAttributes}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={() => navigate(`${ATTRIBUTES_PATH}/new`)}
      onEdit={(row) => navigate(`${ATTRIBUTES_PATH}/${row.id}`)}
      remove={{
        // Deleting an attribute takes every variant selection built on it, so
        // the backend refuses while products still sell its values. The merchant
        // is told how many, and confirms.
        mode: 'confirm',
        remove: ({ id, force }) => deleteMutation.mutateAsync({ id, force }),
        confirmDescription:
          'Products that sell its values will lose those choices. This cannot be undone.',
      }}
    />
  )
}
