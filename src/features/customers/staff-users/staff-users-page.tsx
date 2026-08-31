import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { useSessionStore } from '@/lib/store/session-store'
import { useStaffUsers, useUpdateStaffUser, type StaffUserPatch, type StaffUserRow } from '@/lib/api/staff-users'
import { useRoles } from '@/lib/api/roles'
import { USER_STATUSES, type UserStatus } from '@/lib/api/users'
import { formatDate, formatDateTime } from '@/lib/utils/format'

const STATUS_VARIANT: Record<UserStatus, 'success' | 'secondary' | 'destructive'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
}

const schema = z.object({
  roleId: z.string().min(1, 'Role is required'),
  status: z.enum(USER_STATUSES),
})
type Values = z.infer<typeof schema>

export default function StaffUsersPage() {
  const [search, setSearch] = React.useState('')
  const [editing, setEditing] = React.useState<StaffUserRow | null>(null)
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
  const updateMutation = useUpdateStaffUser()

  const roles = rolesData?.data ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { roleId: editing?.roleId ?? '', status: editing?.status ?? 'ACTIVE' },
  })

  const onSubmit = async (values: Values) => {
    if (!editing) return
    const patch: StaffUserPatch = { status: values.status }
    // Only send roleId when it actually changed — an unchanged value would still trip the
    // backend's OWNER-only check for an ADMIN editing someone's status.
    if (canChangeRole && values.roleId !== editing.roleId) {
      patch.roleId = values.roleId
    }

    try {
      await updateMutation.mutateAsync({ id: editing.id, patch })
      toast({ title: 'User updated' })
      setEditing(null)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

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
            <DropdownMenuItem onClick={() => setEditing(row.original)}>
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing?.name}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FormField control={form.control} name="roleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canChangeRole}>
                    <FormControl><SelectTrigger><SelectValue placeholder={editing?.role.name} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!canChangeRole && <FormDescription>Only an owner can change a user's role.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
