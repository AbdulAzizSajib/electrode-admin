import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import { useAllTaxRules, useDeleteTaxRule, useTaxRules, type TaxRule } from '@/lib/api/tax-rules'
import { formatDate } from '@/lib/utils/format'

export const TAX_RULES_PATH = '/catalog/tax-rules'

/** "5%" or a plain amount, so the row reads as the charge rather than a number and a code. */
function chargeLabel(rule: TaxRule) {
  const value = Number(rule.value)
  return rule.type === 'PERCENT' ? `${value}%` : String(value)
}

export default function TaxRulesPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteTaxRule()
  // Fetched up front so the replacement picker has something to offer the
  // moment the server refuses a delete, rather than showing an empty list
  // while a second request runs.
  const { data: allRules = [] } = useAllTaxRules()

  const columns: ColumnDef<TaxRule>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.type === 'PERCENT' ? 'Percentage' : 'Fixed amount'}
        </Badge>
      ),
    },
    { id: 'value', header: 'Charge', cell: ({ row }) => chargeLabel(row.original) },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ]

  return (
    <ResourceListPage
      title="Tax rules"
      description="A named tax charge, assigned per product. Replaces the single shop-wide rate."
      noun="tax rule"
      icon={Receipt}
      emptyTitle="No tax rules yet"
      emptyDescription="Add a rule so products can be taxed at their own rate."
      searchPlaceholder="Search tax rules…"
      columns={columns}
      useList={useTaxRules}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      onCreate={() => navigate(`${TAX_RULES_PATH}/new`)}
      onEdit={(row) => navigate(`${TAX_RULES_PATH}/${row.id}`)}
      remove={{
        // A product must be taxable, so its rule cannot simply disappear.
        mode: 'reassign',
        remove: ({ id, reassignToId }) => deleteMutation.mutateAsync({ id, reassignToId }),
        reassignOptions: () =>
          allRules.map((rule) => ({ value: rule.id, label: `${rule.name} (${chargeLabel(rule)})` })),
        reassignLabel: 'Move those products to',
      }}
    />
  )
}
