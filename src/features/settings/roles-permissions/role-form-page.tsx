/**
 * A role's name and description.
 *
 * Which permissions the role grants is deliberately not here: those are toggled
 * on `/settings/roles` against the selected role, one grant/revoke request per
 * checkbox, so the server stays the authority on what was actually stored. A
 * form that batched them would have to guess.
 */
import { useParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ResourceFormPageRhf } from '@/components/crud/resource-form-page-rhf'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ROLES_PATH } from '@/features/settings/roles-permissions/roles-permissions-page'
import { useCreateRole, useRole, useUpdateRole, type Role } from '@/lib/api/roles'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: '', description: '' }

const toValues = (role: Role): Values => ({
  name: role.name,
  description: role.description ?? '',
})

export default function RoleFormPage() {
  const { roleId } = useParams()

  const { data, isLoading, error } = useRole(roleId)
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const save = async (values: Values) => {
    // The backend rejects an empty description rather than storing one, so the
    // key is omitted when the field is blank.
    const input = { name: values.name, ...(values.description ? { description: values.description } : {}) }

    if (roleId) {
      await updateMutation.mutateAsync({ id: roleId, input })
      return
    }
    const created = await createMutation.mutateAsync(input)
    return { id: created.id }
  }

  return (
    <ResourceFormPageRhf<Values, Role>
      noun="Role"
      listPath={ROLES_PATH}
      recordId={roleId}
      form={form}
      record={data}
      isLoading={isLoading}
      loadError={error}
      toValues={toValues}
      onSave={save}
      description="Permissions are granted on the roles list, not here."
    >
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </ResourceFormPageRhf>
  )
}
