import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useCustomers,
  customerFullName,
  CUSTOMER_STATUSES,
  type CustomerRow,
  type CustomerStatus,
} from '@/lib/api/customers'
import { formatDate } from '@/lib/utils/format'

const STATUS_VARIANT: Record<CustomerStatus, 'success' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  BLOCKED: 'destructive',
}

export default function CustomersListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | CustomerStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, error, refetch } = useCustomers({
    search,
    page,
    limit: pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const columns: ColumnDef<CustomerRow>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{customerFullName(row.original)}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      // Both email and phone are nullable on the backend — a customer may have neither.
      cell: ({ row }) =>
        row.original.email ? (
          <span className="text-muted-foreground">{row.original.email}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) =>
        row.original.phone ? (
          <span className="text-muted-foreground">{row.original.phone}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: 'createdAt', header: 'Joined', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Customers" description="Everyone who has created a storefront account." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by name, email, or phone…"
        onRowClick={(row) => navigate(`/customers/customers/${row.id}`)}
        emptyState={{ icon: Users, title: 'No customers found' }}
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | CustomerStatus); setPage(1) }}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CUSTOMER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />
    </div>
  )
}
