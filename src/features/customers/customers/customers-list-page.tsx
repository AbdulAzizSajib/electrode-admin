import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { useCustomers, type CustomerRow } from '@/lib/api/customers'
import { formatCurrency, formatDate } from '@/lib/utils/format'

export default function CustomersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCustomers({ search, page, limit: pageSize })

  const columns: ColumnDef<CustomerRow>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
    { accessorKey: 'joinedAt', header: 'Joined', cell: ({ row }) => formatDate(row.original.joinedAt) },
    { accessorKey: 'orderCount', header: 'Orders' },
    { accessorKey: 'totalSpent', header: 'Total spent', cell: ({ row }) => formatCurrency(row.original.totalSpent) },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Customers" description="Everyone who has created a storefront account." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by name or email…"
        onRowClick={(row) => navigate(`/customers/customers/${row.id}`)}
        emptyState={{ icon: Users, title: 'No customers found' }}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />
    </div>
  )
}
