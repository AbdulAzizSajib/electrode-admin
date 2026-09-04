import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import { usePermissions } from '@/lib/api/permissions'
import { useDeleteRole, useGrantPermission, useRevokePermission, useRoles } from '@/lib/api/roles'

export const ROLES_PATH = '/settings/roles'

export default function RolesPermissionsPage() {
  const navigate = useNavigate()
  const { data: rolesData, isLoading, error } = useRoles()
  const { data: permissionsData } = usePermissions()
  const deleteMutation = useDeleteRole()
  const grantMutation = useGrantPermission()
  const revokeMutation = useRevokePermission()
  const confirmDialog = useConfirmDialog()

  /**
   * Which role is selected lives in the URL, not in state: leaving to edit a
   * role and coming back should return to that role rather than to whichever one
   * sorts first, and a link to a specific role's permissions should open on it.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('role')
  const selectRole = (id: string | null) =>
    setSearchParams(id ? { role: id } : {}, { replace: true })

  const roles = rolesData?.data ?? []
  const permissions = permissionsData?.data ?? []
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null

  // The backend `Permission` has no category, so the picker is a flat list rather than grouped.
  const grantedIds = React.useMemo(
    () => new Set(selected?.permissions.map((rp) => rp.permissionId) ?? []),
    [selected],
  )

  /**
   * Grant and revoke are distinct endpoints, and each returns the refreshed role — so the checkbox
   * reflects what the server stored rather than an optimistic local guess. On failure the query
   * is left untouched and the backend's message is surfaced.
   */
  const togglePermission = async (permissionId: string) => {
    if (!selected) return
    const isGranted = grantedIds.has(permissionId)
    try {
      if (isGranted) {
        await revokeMutation.mutateAsync({ roleId: selected.id, permissionId })
      } else {
        await grantMutation.mutateAsync({ roleId: selected.id, permissionId })
      }
    } catch (err) {
      toast({
        title: isGranted ? 'Could not revoke permission' : 'Could not grant permission',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
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

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Roles & Permissions" description="Define what each role can access." />
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load roles.'}</p>
      </div>
    )
  }

  const isToggling = grantMutation.isPending || revokeMutation.isPending

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can access."
        actions={
          <Button size="sm" onClick={() => navigate(`${ROLES_PATH}/new`)}>
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
                onClick={() => selectRole(role.id)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted',
                  selected?.id === role.id && 'bg-muted',
                )}
              >
                <span className="font-medium text-foreground">{role.name}</span>
                <span className="text-xs text-muted-foreground">{role.permissions.length} permissions</span>
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selected.description ?? 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`${ROLES_PATH}/${selected.id}`)}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      confirmDialog.confirm(async () => {
                        try {
                          await deleteMutation.mutateAsync(selected.id)
                          toast({ title: 'Role deleted' })
                          selectRole(null)
                        } catch (err) {
                          toast({ title: 'Could not delete role', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                        }
                      })
                    }
                  >
                    <Trash2 /> Delete role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {permissions.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No permissions defined" />
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {permissions.map((perm) => (
                      <label key={perm.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          className="mt-0.5"
                          checked={grantedIds.has(perm.id)}
                          disabled={isToggling}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <span className="flex flex-col">
                          <span className="text-foreground">{perm.name}</span>
                          {perm.description && (
                            <span className="text-xs text-muted-foreground">{perm.description}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

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
