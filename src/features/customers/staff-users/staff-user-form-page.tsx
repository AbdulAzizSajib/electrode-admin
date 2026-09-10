/**
 * A staff user's role and status. Edit only — this panel has no invite flow, so
 * there is no create route to pair with it.
 */
import { useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { STAFF_USERS_PATH } from '@/features/customers/staff-users/staff-users-page'
import { useSessionStore } from '@/lib/store/session-store'
import {
  useStaffUser,
  useUpdateStaffUser,
  type StaffUserPatch,
  type StaffUserRow,
} from '@/lib/api/staff-users'
import { useRoles } from '@/lib/api/roles'
import { USER_STATUSES } from '@/lib/api/users'

const schema = z.object({
  roleId: z.string().min(1, 'Role is required'),
  status: z.enum(USER_STATUSES),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { roleId: '', status: 'ACTIVE' }

const toValues = (user: StaffUserRow): Values => ({ roleId: user.roleId, status: user.status })

export default function StaffUserFormPage() {
  const { userId } = useParams()

  const currentRole = useSessionStore((s) => s.user?.role)
  // Only an OWNER may reassign a role — the backend enforces this, and disabling the control
  // avoids offering an ADMIN a change that would come back as a 403.
  const canChangeRole = currentRole === 'OWNER'

  const { data, isLoading, error } = useStaffUser(userId)
  // `/roles` is OWNER-only, so a non-OWNER skips the request entirely rather than firing one that
  // would come back 403; their role picker is disabled anyway.
  const { data: rolesData } = useRoles({}, { enabled: canChangeRole })
  const updateMutation = useUpdateStaffUser()

  const roles = rolesData?.data ?? []

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const save = async (values: Values) => {
    if (!userId) return

    const patch: StaffUserPatch = { status: values.status }
    // Only send roleId when it actually changed — an unchanged value would still trip the
    // backend's OWNER-only check for an ADMIN editing someone's status.
    if (canChangeRole && values.roleId !== data?.roleId) {
      patch.roleId = values.roleId
    }

    await updateMutation.mutateAsync({ id: userId, patch })
  }

  return (
    <ResourceFormPage<Values, StaffUserRow>
      noun="User"
      listPath={STAFF_USERS_PATH}
      recordId={userId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      onSave={save}
      title={data ? `Edit ${data.name}` : 'Edit user'}
      description={data?.email}
    >
      <FormField control={form.control} name="roleId" render={({ field }) => (
        <FormItem>
          <FormLabel>Role</FormLabel>
          <Select value={field.value} onValueChange={field.onChange} disabled={!canChangeRole}>
            <FormControl><SelectTrigger><SelectValue placeholder={data?.role.name} /></SelectTrigger></FormControl>
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
    </ResourceFormPage>
  )
}
