import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import { usePermissions } from '@/lib/api/permissions'
import { useCreateRole, useDeleteRole, useRoles, useTogglePermission } from '@/lib/api/roles'

const schema = z.object({ name: z.string().min(1, 'Name is required'), description: z.string().min(1, 'Description is required') })
type Values = z.infer<typeof schema>

export default function RolesPermissionsPage() {
  const { data: rolesData, isLoading } = useRoles()
  const { data: permissionsData } = usePermissions()
  const createMutation = useCreateRole()
  const deleteMutation = useDeleteRole()
  const toggleMutation = useTogglePermission()
  const confirmDialog = useConfirmDialog()

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const roles = rolesData?.data ?? []
  const permissions = permissionsData?.data ?? []
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null

  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    acc[p.category] = acc[p.category] ? [...acc[p.category], p] : [p]
    return acc
  }, {})

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '' } })

  const onSubmit = async (values: Values) => {
    try {
      const created = await createMutation.mutateAsync(values)
      toast({ title: 'Role created' })
      setSheetOpen(false)
      form.reset()
      setSelectedId(created.id)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can access."
        actions={
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus /> New role
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted',
                  selected?.id === role.id && 'bg-muted',
                )}
              >
                <span className="font-medium text-foreground">{role.name}</span>
                <span className="text-xs text-muted-foreground">{role.permissionIds.length} permissions</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-10">
              <EmptyState icon={ShieldCheck} title="No roles yet" description="Create a role to start assigning permissions." />
            </CardContent>
          ) : (
            <>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{selected.name}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    confirmDialog.confirm(async () => {
                      try {
                        await deleteMutation.mutateAsync(selected.id)
                        toast({ title: 'Role deleted' })
                        setSelectedId(null)
                      } catch (err) {
                        toast({ title: 'Could not delete role', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                      }
                    })
                  }
                >
                  <Trash2 /> Delete role
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {Object.entries(grouped).map(([category, perms]) => (
                  <div key={category} className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</span>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {perms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selected.permissionIds.includes(perm.id)}
                            onCheckedChange={() => toggleMutation.mutate({ roleId: selected.id, permissionId: perm.id })}
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>New role</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>Create role</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this role?"
        description="Roles assigned to a user cannot be deleted."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
