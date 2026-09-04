import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSessionStore } from '@/lib/store/session-store'
import { useStaffUsers, type StaffUserRow } from '@/lib/api/staff-users'
import { useRoles } from '@/lib/api/roles'
import { USER_STATUSES, type UserStatus } from '@/lib/api/users'
import { formatDate, formatDateTime } from '@/lib/utils/format'

export const STAFF_USERS_PATH = '/settings/staff'

const STATUS_VARIANT: Record<UserStatus, 'success' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
}

export default function StaffUsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | UserStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const currentUserId = useSessionStore((s) => s.user?.id)
  const currentRole = useSessionStore((s) => s.user?.role)
  // Only an OWNER may reassign a role — the backend enforces this, and disabling the control
  // avoids offering an ADMIN a change that would come back as a 403.
  const canChangeRole = currentRole === 'OWNER'

  const { data, isLoading, isError, refetch } = useStaffUsers({
    search,
    page,
    limit: pageSize,
    roleId: roleFilter === 'all' ? undefined : roleFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  // `/roles` is OWNER-only, so a non-OWNER skips the request entirely rather than firing one that
  // would come back 403; their role picker is disabled anyway.
  const { data: rolesData } = useRoles({}, { enabled: canChangeRole })

  const roles = rolesData?.data ?? []

  const columns: ColumnDef<StaffUserRow>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.name}
          {row.original.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
        </span>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
    { id: 'role', header: 'Role', cell: ({ row }) => <Badge variant="outline">{row.original.role.name}</Badge> },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    {
      id: 'lastLoginAt',
      header: 'Last sign-in',
      // Null means never signed in — shown explicitly rather than as a blank or an epoch date.
      cell: ({ row }) =>
        row.original.lastLoginAt ? (
          formatDateTime(row.original.lastLoginAt)
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
    { accessorKey: 'createdAt', header: 'Added', cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`${STAFF_USERS_PATH}/${row.original.id}`)}>
              <Pencil /> Edit role &amp; status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Staff Users" description="Team members with access to this admin panel." />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by name or email…"
        emptyState={{ icon: UserCog, title: 'No staff users found' }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {canChangeRole && (
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | UserStatus); setPage(1) }}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
