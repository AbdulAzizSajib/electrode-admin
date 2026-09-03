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
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Plus, Trash2, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  COUPON_STATUSES,
  COUPON_TYPES,
  type Coupon,
  type CouponInput,
  type CouponStatus,
  type CouponType,
} from '@/lib/api/coupons'
import { formatDate } from '@/lib/utils/format'

const TYPE_LABEL: Record<CouponType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED: 'Fixed amount',
  FREE_SHIPPING: 'Free shipping',
}

const STATUS_VARIANT: Record<CouponStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  EXPIRED: 'warning',
}

/** Blank clears the value: these are optional on the backend, so an empty field is omitted. */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().nonnegative('Cannot be negative').optional(),
)
const optionalPositiveInt = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().int('Must be a whole number').positive('Must be at least 1').optional(),
)

const schema = z
  .object({
    code: z.string().trim().min(2, 'Code must be at least 2 characters').max(50),
    description: z.string().trim().max(500),
    type: z.enum(COUPON_TYPES),
    value: z.coerce.number().nonnegative('Cannot be negative'),
    minimumOrderAmount: optionalNumber,
    maximumDiscountAmount: optionalNumber,
    usageLimit: optionalPositiveInt,
    perCustomerLimit: optionalPositiveInt,
    startsAt: z.string(),
    expiresAt: z.string(),
    status: z.enum(COUPON_STATUSES),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.expiresAt && v.expiresAt < v.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'Expiry must be after the start', path: ['expiresAt'] })
    }
    if (v.type === 'PERCENTAGE' && v.value > 100) {
      ctx.addIssue({ code: 'custom', message: 'A percentage cannot exceed 100', path: ['value'] })
    }
  })
type Values = z.input<typeof schema>
type OutputValues = z.output<typeof schema>

const EMPTY_VALUES: Values = {
  code: '',
  description: '',
  type: 'PERCENTAGE',
  value: 10,
  minimumOrderAmount: '',
  maximumDiscountAmount: '',
  usageLimit: '',
  perCustomerLimit: '',
  startsAt: '',
  expiresAt: '',
  status: 'ACTIVE',
}

function toFormValues(c: Coupon): Values {
  return {
    code: c.code,
    description: c.description ?? '',
    type: c.type,
    value: c.value,
    minimumOrderAmount: c.minimumOrderAmount ?? '',
    maximumDiscountAmount: c.maximumDiscountAmount ?? '',
    usageLimit: c.usageLimit ?? '',
    perCustomerLimit: c.perCustomerLimit ?? '',
    startsAt: c.startsAt ? c.startsAt.slice(0, 10) : '',
    expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    status: c.status,
  }
}

function toCouponPayload(v: OutputValues): CouponInput {
  const input: CouponInput = {
    code: v.code,
    type: v.type,
    value: v.value,
    status: v.status,
  }
  if (v.description) input.description = v.description
  if (v.minimumOrderAmount !== undefined) input.minimumOrderAmount = v.minimumOrderAmount
  if (v.maximumDiscountAmount !== undefined) input.maximumDiscountAmount = v.maximumDiscountAmount
  if (v.usageLimit !== undefined) input.usageLimit = v.usageLimit
  if (v.perCustomerLimit !== undefined) input.perCustomerLimit = v.perCustomerLimit
  // Date inputs give "YYYY-MM-DD"; the backend validates full ISO datetimes. The expiry is pushed
  // to end-of-day so a voucher does not silently die at midnight on the date the admin picked.
  if (v.startsAt) input.startsAt = new Date(`${v.startsAt}T00:00:00.000Z`).toISOString()
  if (v.expiresAt) input.expiresAt = new Date(`${v.expiresAt}T23:59:59.999Z`).toISOString()
  return input
}

/** `FREE_SHIPPING` carries no numeric amount to show. */
function formatDiscount(c: Coupon): string {
  if (c.type === 'FREE_SHIPPING') return 'Free shipping'
  if (c.type === 'PERCENTAGE') return `${c.value}%`
  return c.value
}

export default function VouchersPage() {
  const [search, setSearch] = React.useState('')
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Coupon | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<'all' | CouponStatus>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading, isError, refetch } = useCoupons({
    search,
    page,
    limit: pageSize,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const createMutation = useCreateCoupon()
  const updateMutation = useUpdateCoupon()
  const deleteMutation = useDeleteCoupon()
  const confirmDialog = useConfirmDialog()

  const form = useForm<Values, unknown, OutputValues>({
    resolver: zodResolver(schema),
    values: editing ? toFormValues(editing) : EMPTY_VALUES,
  })

  const voucherType = form.watch('type')

  const onSubmit = async (values: OutputValues) => {
    try {
      const input = toCouponPayload(values)
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input })
        toast({ title: 'Voucher updated' })
      } else {
        await createMutation.mutateAsync(input)
        toast({ title: 'Voucher created' })
      }
      setSheetOpen(false)
    } catch (err) {
      toast({ title: 'Something went wrong', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
  }

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
            <DropdownMenuItem onClick={() => { setEditing(row.original); setSheetOpen(true) }}>
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
          <Button size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? 'Edit voucher' : 'New voucher'}</SheetTitle></SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3.5 overflow-y-auto">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {COUPON_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{voucherType === 'PERCENTAGE' ? 'Percent off' : 'Value'}</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="minimumOrderAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. order amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormDescription>Blank means no minimum.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maximumDiscountAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. discount</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormDescription>Caps a percentage discount.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="usageLimit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage limit</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormDescription>Blank means unlimited.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="perCustomerLimit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per-customer limit</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} value={field.value === undefined ? '' : String(field.value)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expiresAt" render={({ field }) => (
                  <FormItem><FormLabel>Expires</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {COUPON_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Save changes' : 'Create voucher'}</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

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
