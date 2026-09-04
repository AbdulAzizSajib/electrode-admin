/**
 * Vouchers — what this panel now calls the discount codes the backend still
 * models as `Coupon`.
 *
 * The rename is deliberately skin-deep: route, page title and every string a
 * merchant reads. The API module, its types and the database are untouched,
 * because nothing about the record changed — only what it is called. Renaming
 * the model too would mean a migration, a storefront change and a broken
 * `appliedCoupon` cookie, all to no one's benefit.
 *
 * See align-admin-catalog-with-reference — "Coupons are renamed Vouchers in the
 * admin. Our `Coupon` already carries every field the reference voucher has;
 * this is a label and route change, not a new model."
 */
import * as React from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  useCoupons,
  useDeleteCoupon,
  COUPON_STATUSES,
  type Coupon,
  type CouponStatus,
} from '@/lib/api/coupons'
import { formatDate } from '@/lib/utils/format'

export const VOUCHERS_PATH = '/marketing/vouchers'

const STATUS_VARIANT: Record<CouponStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  EXPIRED: 'warning',
}

/** `FREE_SHIPPING` carries no numeric amount to show. */
function formatDiscount(c: Coupon): string {
  if (c.type === 'FREE_SHIPPING') return 'Free shipping'
  if (c.type === 'PERCENTAGE') return `${c.value}%`
  return c.value
}

export default function VouchersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | CouponStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCoupons({
    search,
    page,
    limit: pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const deleteMutation = useDeleteCoupon()
  const confirmDialog = useConfirmDialog()

  const columns: ColumnDef<Coupon>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono font-medium text-foreground">{row.original.code}</span> },
    { id: 'discount', header: 'Discount', cell: ({ row }) => formatDiscount(row.original) },
    {
      id: 'usage',
      header: 'Usage',
      // Redemption counts are recorded server-side as orders are placed — shown, never edited.
      cell: ({ row }) => `${row.original.usageCount} / ${row.original.usageLimit ?? '∞'}`,
    },
    {
      id: 'window',
      header: 'Valid',
      cell: ({ row }) => {
        const { startsAt, expiresAt } = row.original
        if (!startsAt && !expiresAt) return <span className="text-muted-foreground">Always</span>
        return `${startsAt ? formatDate(startsAt) : '—'} – ${expiresAt ? formatDate(expiresAt) : '—'}`
      },
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`${VOUCHERS_PATH}/${row.original.id}`)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirmDialog.confirm(async () => {
                  try {
                    await deleteMutation.mutateAsync(row.original.id)
                    toast({ title: 'Voucher deleted' })
                  } catch (err) {
                    toast({ title: 'Could not delete voucher', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
                  }
                })
              }
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Vouchers"
        description="Discount codes customers can apply at checkout."
        actions={
          <Button size="sm" onClick={() => navigate(`${VOUCHERS_PATH}/new`)}>
            <Plus /> New voucher
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by code…"
        emptyState={{ icon: Ticket, title: 'No vouchers yet' }}
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | CouponStatus); setPage(1) }}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {COUPON_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        page={page}
        pageSize={pageSize}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={confirmDialog.setOpen}
        title="Delete this voucher?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={confirmDialog.pending}
        onConfirm={confirmDialog.handleConfirm}
      />
    </div>
  )
}
